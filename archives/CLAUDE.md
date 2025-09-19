# [Archived] CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (React/TypeScript)
```bash
cd frontend
npm install
npm start          # Development server
npm run build      # Production build
npm test           # Run tests
```

### Backend (FastAPI/Python)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload    # Development server
python main.py               # Alternative server start
```

## Architecture Overview

This is a Fitbit to Garmin data converter web application with a React frontend and FastAPI backend.

### Core Components

**Backend Architecture** (`/backend/`):
- `main.py` - FastAPI application with CORS, rate limiting, and file processing endpoints
- `converter.py` - Core logic for converting Fitbit JSON to Garmin .fit files using fit-tool library
- `models.py` - Pydantic models for API requests/responses and validation
- `fingerprint.py` - Rate limiting and abuse protection using browser fingerprinting

**Frontend Architecture** (`/frontend/src/`):
- `App.tsx` - Main React application with file upload workflow
- `components/FileUpload.tsx` - Drag-and-drop file upload with validation
- `components/ConversionProgress.tsx` - Progress tracking during conversion
- `components/DownloadManager.tsx` - Download interface for converted files
- `services/api.ts` - API client for backend communication
- `services/fingerprint.ts` - Browser fingerprinting for rate limiting

### Key Technical Details

**Data Conversion Process**:
1. Accepts Google Takeout Fitbit JSON files (`weight-YYYY-MM-DD.json`)
2. Converts Fitbit timestamps (Unix format) to Garmin-compatible .fit files
3. Converts weight units from pounds to kilograms
4. Preserves body fat percentage when available
5. Generates week-based .fit filenames (`Weight WW-YYYY Fitbit.fit`)

**Critical Implementation Notes**:
- Uses Unix timestamps directly (not FIT epoch) - see docs/FITBIT_GOOGLE_TAKEOUT_TO_GARMIN.md
- Rate limiting: 2 file conversions per day via fingerprinting
- CORS configured for localhost development
- In-memory storage for uploaded files (production should use Redis/DB)

### Dependencies

**Backend**: FastAPI, uvicorn, fit-tool (0.9.13), pydantic, python-multipart, aiofiles
**Frontend**: React 18, TypeScript, Tailwind CSS, @headlessui/react, react-dropzone, axios


## Important File Patterns

- `weight-*.json` - Google Takeout Fitbit export files
- `Weight *.fit` - Generated Garmin-compatible output files
- `docs/FITBIT_GOOGLE_TAKEOUT_TO_GARMIN.md` - Technical conversion documentation
