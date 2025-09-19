# Fitbit Google Takeout to Garmin Converter

🔄 **Convert your Fitbit weight data from Google Takeout to Garmin-compatible .fit files**

## What This Does

This tool converts weight data exported from Fitbit via Google Takeout into .fit files that can be imported into Garmin Connect, preserving your historical weight tracking data when migrating from Fitbit to Garmin devices.

## Features

- ✅ **Google Takeout Compatible**: Works with the latest Fitbit export format
- ✅ **Proven Algorithm**: Successfully tested with 12+ years of weight data
<!-- ✅ **Free Tier**: Convert 2 files per day -->
- ✅ **Abuse Protection**: Built-in rate limiting
- ✅ **Body Fat Support**: Preserves body fat percentage when available

## How to Use

1. **Export from Fitbit**:
   - Go to Fitbit app → Profile → Data Export
   - Use Google Takeout to download your data
   - Find weight files in `Global Export Data/weight-YYYY-MM-DD.json`

2. **Convert**:
   - Upload up to 3 JSON files
   - Download the generated .fit files

3. **Import to Garmin**:
   - Upload .fit files to Garmin Connect
   - Your weight history will appear in your timeline

## Technical Details

See `docs/FITBIT_GOOGLE_TAKEOUT_TO_GARMIN.md` for the complete technical breakdown of our timestamp breakthrough and conversion algorithm.

## Project Structure

```
fitbit-takeout-to-garmin/
├── docs/                     # Technical documentation
├── backend/                  # FastAPI server
├── frontend/                 # React application
└── README.md
```

## Development

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (React)
```bash
cd frontend
npm install
npm start
```

## Deployment

Cloudflare Pages (frontend) + FastAPI (backend)

- Frontend (Cloudflare Pages):
  - Root directory: `frontend`
  - Build command: `npm ci && npm run build`
  - Build output directory: `dist`
  - Optional Functions directory: `frontend/functions` (upload/download only; conversion disabled)
- Backend (FastAPI):
  - Run locally: `cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --reload`
  - Deploy to your preferred Python host (e.g. Fly.io/Render/Cloud Run)

Frontend → Backend API routing

- Preferred: set `VITE_API_URL` in the Pages project to your backend API (e.g. `https://api.example.com/api`). The frontend will call the backend directly and bypass Pages Functions.
- If you keep Pages Functions for upload/download, the convert endpoint returns 501 with guidance to use the Python backend.

Notes

- TypeScript target is ES2020 to avoid ES5 downleveling issues during Functions bundling.
- Functions dependencies are installed during `postbuild` via `cd functions && npm ci`.
- Conversion logic is implemented in Python per `docs/FITBIT_GOOGLE_TAKEOUT_TO_GARMIN.md` for guaranteed compatibility with Garmin Connect.

---

**Built by the community, for the community** 🏃‍♂️💨
