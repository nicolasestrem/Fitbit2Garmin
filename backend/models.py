"""
Pydantic models for API requests and responses
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class FingerprintData(BaseModel):
    """Browser fingerprint data for abuse prevention"""
    fingerprint_hash: str = Field(..., description="Hashed browser fingerprint")
    user_agent: str = Field(..., max_length=500)
    screen_resolution: str = Field(..., max_length=20)
    timezone: str = Field(..., max_length=50)


class UploadResponse(BaseModel):
    """Response after file upload"""
    upload_id: str = Field(..., description="Unique upload identifier")
    files_received: int = Field(..., description="Number of files received")
    message: str = Field(..., description="Status message")


class ConversionRequest(BaseModel):
    """Request to convert uploaded files"""
    upload_id: str = Field(..., description="Upload identifier from upload response")


class ConversionResponse(BaseModel):
    """Response after conversion"""
    conversion_id: str = Field(..., description="Unique conversion identifier")
    files_converted: int = Field(..., description="Number of files converted")
    total_entries: int = Field(..., description="Total weight entries processed")
    download_urls: List[str] = Field(..., description="URLs to download converted files")
    message: str = Field(..., description="Status message")


class UsageLimits(BaseModel):
    """Current usage limits for user"""
    conversions_used: int = Field(..., description="Conversions used today")
    conversions_limit: int = Field(..., description="Daily conversion limit")
    time_until_reset: int = Field(..., description="Seconds until daily reset")
    can_convert: bool = Field(..., description="Whether user can convert more files")


class ErrorResponse(BaseModel):
    """Error response format"""
    error: str = Field(..., description="Error message")
    details: Optional[str] = Field(None, description="Additional error details")
    error_code: Optional[str] = Field(None, description="Error code for programmatic handling")


class FileValidationResult(BaseModel):
    """Result of file validation"""
    filename: str = Field(..., description="Original filename")
    is_valid: bool = Field(..., description="Whether file is valid Google Takeout format")
    entry_count: Optional[int] = Field(None, description="Number of weight entries found")
    date_range: Optional[str] = Field(None, description="Date range of data")
    error_message: Optional[str] = Field(None, description="Validation error if any")


class ConversionJob(BaseModel):
    """Internal model for tracking conversion jobs"""
    job_id: str
    fingerprint_hash: str
    ip_address: str
    upload_timestamp: datetime
    files_data: List[Dict[str, Any]]
    status: str  # "pending", "processing", "completed", "failed"
    created_at: datetime
    completed_at: Optional[datetime] = None


class UsageRecord(BaseModel):
    """Internal model for tracking usage"""
    fingerprint_hash: str
    ip_address: str
    conversions_count: int = 0
    last_conversion: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime