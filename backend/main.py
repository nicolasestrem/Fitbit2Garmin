"""
FastAPI backend for Fitbit Google Takeout to Garmin Converter
"""

import json
import uuid
import asyncio
from datetime import datetime
from typing import List, Dict, Any
from fastapi import FastAPI, File, UploadFile, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import ValidationError

from models import (
    FingerprintData,
    ConversionRequest,
    ConversionResponse,
    UploadResponse,
    UsageLimits,
    ErrorResponse,
    FileValidationResult
)
from converter import convert_fitbit_to_garmin
from fingerprint import fingerprint_manager

# Initialize FastAPI app
app = FastAPI(
    title="Fitbit to Garmin Converter",
    description="Convert Fitbit Google Takeout data to Garmin-compatible .fit files",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",           # Local development
        "https://*.vercel.app",            # Vercel deployments
        "https://fitbit2garmin.app",       # Custom domain
        "https://www.fitbit2garmin.app",   # Custom domain with www
        "*"                                # Allow all for now (tighten in production)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# In-memory storage for uploaded files (use Redis/DB in production)
uploaded_files: Dict[str, List[Dict[str, Any]]] = {}
converted_files: Dict[str, List[tuple]] = {}

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Fitbit to Garmin Converter API",
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/usage/{fingerprint_hash}")
async def get_usage_limits(
    fingerprint_hash: str,
    request: Request
) -> UsageLimits:
    """Get current usage limits for a user"""
    try:
        # Create fingerprint data from hash (simplified for this endpoint)
        fingerprint_data = FingerprintData(
            fingerprint_hash=fingerprint_hash,
            user_agent=request.headers.get("user-agent", ""),
            screen_resolution="unknown",
            timezone="unknown"
        )

        ip_address = request.client.host
        usage_stats = fingerprint_manager.get_usage_stats(fingerprint_data, ip_address)

        return UsageLimits(**usage_stats)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving usage limits: {str(e)}")

@app.post("/upload")
async def upload_files(
    request: Request,
    files: List[UploadFile] = File(...)
) -> UploadResponse:
    """
    Upload Google Takeout weight JSON files
    Maximum 2 files for free tier
    """
    try:
        # Validate file count
        if len(files) > 2:
            raise HTTPException(
                status_code=400,
                detail="Maximum 2 files allowed. Upgrade for bulk processing."
            )

        if len(files) == 0:
            raise HTTPException(status_code=400, detail="No files provided")

        # Validate file types
        for file in files:
            if not file.filename.endswith('.json'):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid file type: {file.filename}. Only .json files are supported."
                )

        # Process files
        upload_id = str(uuid.uuid4())
        file_data = []

        for file in files:
            content = await file.read()
            try:
                json_data = json.loads(content.decode('utf-8'))
                file_data.append({
                    "filename": file.filename,
                    "data": json_data
                })
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid JSON in file: {file.filename}"
                )

        # Store uploaded data
        uploaded_files[upload_id] = file_data

        return UploadResponse(
            upload_id=upload_id,
            files_received=len(files),
            message=f"Successfully uploaded {len(files)} files"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/validate")
async def validate_files(
    upload_id: str,
    request: Request
) -> List[FileValidationResult]:
    """Validate uploaded files format"""
    try:
        if upload_id not in uploaded_files:
            raise HTTPException(status_code=404, detail="Upload ID not found")

        file_data = uploaded_files[upload_id]
        validation_results = []

        for file_info in file_data:
            filename = file_info["filename"]
            data = file_info["data"]

            try:
                # Basic validation
                if not isinstance(data, list) or not data:
                    validation_results.append(FileValidationResult(
                        filename=filename,
                        is_valid=False,
                        error_message="File must contain an array of weight entries"
                    ))
                    continue

                # Check for required fields
                first_entry = data[0]
                required_fields = ['logId', 'weight', 'date', 'time']
                missing_fields = [field for field in required_fields if field not in first_entry]

                if missing_fields:
                    validation_results.append(FileValidationResult(
                        filename=filename,
                        is_valid=False,
                        error_message=f"Missing required fields: {', '.join(missing_fields)}"
                    ))
                    continue

                # Extract date range
                dates = [entry.get('date', '') for entry in data]
                date_range = f"{dates[0]} to {dates[-1]}" if dates else "Unknown"

                validation_results.append(FileValidationResult(
                    filename=filename,
                    is_valid=True,
                    entry_count=len(data),
                    date_range=date_range
                ))

            except Exception as e:
                validation_results.append(FileValidationResult(
                    filename=filename,
                    is_valid=False,
                    error_message=f"Validation error: {str(e)}"
                ))

        return validation_results

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

@app.post("/convert")
async def convert_files(
    conversion_request: ConversionRequest,
    request: Request
) -> ConversionResponse:
    """Convert uploaded files to Garmin .fit format"""
    try:
        # Check upload exists
        if conversion_request.upload_id not in uploaded_files:
            raise HTTPException(status_code=404, detail="Upload ID not found")

        # Rate limiting check
        ip_address = request.client.host
        can_proceed, usage_record = fingerprint_manager.check_rate_limit(
            conversion_request.fingerprint, ip_address
        )

        if not can_proceed:
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit exceeded. Used {usage_record.conversions_count}/2 conversions."
            )

        # Detect suspicious activity
        if fingerprint_manager.detect_suspicious_activity(ip_address):
            raise HTTPException(
                status_code=429,
                detail="Suspicious activity detected. Please try again later."
            )

        # Get uploaded file data
        file_data = uploaded_files[conversion_request.upload_id]

        # Prepare data for conversion
        json_files = []
        for file_info in file_data:
            json_files.append((file_info["filename"], file_info["data"]))

        # Perform conversion
        converted_results = convert_fitbit_to_garmin(json_files)

        # Generate conversion ID and store results
        conversion_id = str(uuid.uuid4())
        converted_files[conversion_id] = converted_results

        # Record successful conversion
        fingerprint_manager.record_conversion(conversion_request.fingerprint, ip_address)

        # Generate download URLs
        download_urls = []
        total_entries = 0
        for output_filename, _ in converted_results:
            download_urls.append(f"/download/{conversion_id}/{output_filename}")

        # Count total entries (simplified)
        for _, file_info in enumerate(file_data):
            total_entries += len(file_info["data"])

        return ConversionResponse(
            conversion_id=conversion_id,
            files_converted=len(converted_results),
            total_entries=total_entries,
            download_urls=download_urls,
            message=f"Successfully converted {len(converted_results)} files"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

@app.get("/download/{conversion_id}/{filename}")
async def download_file(conversion_id: str, filename: str):
    """Download a converted .fit file"""
    try:
        if conversion_id not in converted_files:
            raise HTTPException(status_code=404, detail="Conversion ID not found")

        # Find the requested file
        for output_filename, fit_bytes in converted_files[conversion_id]:
            if output_filename == filename:
                return Response(
                    content=fit_bytes,
                    media_type="application/octet-stream",
                    headers={
                        "Content-Disposition": f"attachment; filename={filename}"
                    }
                )

        raise HTTPException(status_code=404, detail="File not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    """Handle Pydantic validation errors"""
    return JSONResponse(
        status_code=422,
        content=ErrorResponse(
            error="Validation error",
            details=str(exc),
            error_code="VALIDATION_ERROR"
        ).dict()
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.detail,
            error_code="HTTP_ERROR"
        ).dict()
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)