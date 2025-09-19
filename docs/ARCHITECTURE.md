# Architecture

Overview

- Frontend: React + Vite (frontend/), deployed to Cloudflare Pages (fitbit2garmin.app)
- API: Cloudflare Pages Functions under /api (frontend/functions/api)
- Storage: Cloudflare R2 (object storage) and KV (metadata)
- FIT Encoding: Garmin @garmin/fitsdk Encoder in Functions
- Optional: Python FastAPI backend retained in backend/ (not required for prod)

Key Endpoints (Pages Functions)

- GET /api/ → health/status JSON
- POST /api/upload → multipart/form-data, accepts up to 3 .json files
- POST /api/convert → JSON { upload_id }, converts uploaded JSON to .fit and stores in R2
- GET /api/download/{conversion_id}/{filename} → returns .fit file

Data Flow

1) Upload: files → R2 at uploads/{upload_id}/{original_name}.json; KV key upload:{upload_id}
2) Convert: read uploaded JSON from R2; build FIT using Encoder; write to R2 at converted/{conversion_id}/{Weight WW-YYYY Fitbit.fit}; KV key conversion:{conversion_id}
3) Download: fetch object from R2 and stream with Content-Disposition attachment

Storage Layout

- KV (RATE_LIMITS):
  - upload:{upload_id} → { files: [{ filename, size }], timestamp, status }
  - conversion:{conversion_id} → { upload_id, files: [names], timestamp, total_entries, status }
- R2 (FILE_STORAGE bucket fitbit2garmin-files):
  - uploads/{upload_id}/{original_name}.json
  - converted/{conversion_id}/{Weight WW-YYYY Fitbit.fit}

FIT Message Mapping

- FILE_ID
  - type = 4 (WEIGHT)
  - manufacturer = 255 (FITBIT_ID)
  - product = 1
  - productName = "Health Sync"
  - serialNumber = 1701
  - number = 0
  - timeCreated = Date(ms) from first JSON entry (SDK encodes to FIT date)
- WEIGHT_SCALE (per entry)
  - timestamp = Date(ms) from entry (prefers logId, falls back to parsed date/time)
  - weight = kilograms (SDK applies scale 100)
  - boneMass = 0.0
  - muscleMass = 0.0
  - percentFat = rounded to 0.1 if present
  - percentHydration = 0.0

Filename Convention

- Weight WW-YYYY Fitbit.fit (week number derived from input filename date or first entry)

Routing

- _redirects:
  - /api/*    /api/:splat   200
  - /*        /index.html   200
- _routes.json:
  - { "version": 1, "include": ["/api/*"], "exclude": [] }

Environment & Bindings

- wrangler.toml (Pages):
  - pages_build_output_dir = "frontend/dist"
  - compatibility_date = "2023-12-01"
  - compatibility_flags = ["nodejs_compat"]
  - [vars]: VITE_API_URL (default "/api") and ENVIRONMENT
  - [[kv_namespaces]] RATE_LIMITS
  - [[r2_buckets]] FILE_STORAGE (fitbit2garmin-files)

References

- docs/FITBIT_GOOGLE_TAKEOUT_TO_GARMIN.md — background and algorithm details
