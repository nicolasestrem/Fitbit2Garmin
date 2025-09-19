# Fitbit Google Takeout → Garmin FIT Converter

Convert Fitbit weight data (Google Takeout) into Garmin‑compatible .fit files and import them into Garmin Connect.

Live app

- https://fitbit2garmin.app/

Features

- Google Takeout compatible: accepts weight-YYYY-MM-DD.json
- Accurate FIT output using @garmin/fitsdk Encoder
- Upload multiple files and download .fit results
- Runs fully on Cloudflare Pages (Functions + R2 + KV)

How to use

1) Export from Fitbit (Google Takeout) and locate weight-YYYY-MM-DD.json files
2) Upload 1–3 files in the app
3) Convert to .fit — we generate Weight WW-YYYY Fitbit.fit
4) Download and import each file into Garmin Connect

Docs

- docs/ARCHITECTURE.md — system + API + storage
- docs/DEPLOYMENT.md — Cloudflare Pages config + bindings + env vars
- docs/TROUBLESHOOTING.md — routing, bundling, conversion, download issues
- docs/CHANGELOG.md — what changed and when
- docs/FITBIT_GOOGLE_TAKEOUT_TO_GARMIN.md — conversion algorithm background

Development

Frontend

```bash
cd frontend
npm ci
npm run dev
```

Pages dev (serve built output + Functions)

```bash
cd frontend && npm run build
npx wrangler pages dev frontend/dist
```

Deployment

See docs/DEPLOYMENT.md. In short:

```bash
cd frontend && npm ci && npm run build
npx wrangler pages deploy frontend/dist --project-name fitbit2garmin --commit-dirty=true
```

Environment & bindings (wrangler.toml)

- [vars]: VITE_API_URL (default "/api"), ENVIRONMENT
- [[kv_namespaces]]: RATE_LIMITS
- [[r2_buckets]]: FILE_STORAGE (fitbit2garmin-files)
- compatibility_flags = ["nodejs_compat"]

Notes

- Encoder usage: writeMesg(...) then close() → Uint8Array (no pipes)
- Filenames with spaces are handled: client encodes, server decodes
- The tested/ folder includes the proven Python script for reference only
