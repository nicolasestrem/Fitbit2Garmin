# Deployment (Cloudflare Pages)

Project settings (GUI)

- Root directory: frontend
- Build command: npm ci && npm run build
- Build output directory: dist
- Functions directory: frontend/functions

Bindings

- KV: RATE_LIMITS (wrangler.toml [[kv_namespaces]] or Dashboard → Pages → Functions → KV)
- R2: FILE_STORAGE → fitbit2garmin-files (wrangler.toml [[r2_buckets]] or Dashboard → Pages → Functions → R2)

Environment variables

- Build-time: wrangler.toml [vars]
  - VITE_API_URL — where the frontend calls the API; default "/api" (Pages Functions)
  - ENVIRONMENT — optional (e.g., production)
- Secrets: Dashboard only (Pages → Settings → Environment variables → Add secret)

wrangler.toml (excerpt)

```
name = "fitbit2garmin"
pages_build_output_dir = "frontend/dist"
compatibility_date = "2023-12-01"
compatibility_flags = ["nodejs_compat"]

[vars]
ENVIRONMENT = "production"
VITE_API_URL = "/api"

[[kv_namespaces]]
binding = "RATE_LIMITS"
id = "<your-kv-namespace-id>"

[[r2_buckets]]
binding = "FILE_STORAGE"
bucket_name = "fitbit2garmin-files"
```

Build & deploy (CLI)

```
cd frontend && npm ci && npm run build
npx wrangler pages deploy frontend/dist --project-name fitbit2garmin --commit-dirty=true
```

Local dev

```
npx wrangler pages dev frontend/dist
```

Post-deploy verification

- GET /api/ → JSON status
- POST /api/upload with a sample weight JSON → returns upload_id
- POST /api/convert { upload_id } → returns download_urls
- GET /api/download/{conversion_id}/{filename} → returns FIT (Content-Disposition: attachment)

Notes

- TypeScript target is ES2020 to avoid esbuild ES5 transformations breaking Functions
- The Garmin SDK is used via Encoder.writeMesg + Encoder.close() (no stream piping)
