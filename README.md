# Trackersync — Fitbit Google Takeout to Garmin .fit

Trackersync converts Fitbit Google Takeout weight exports into Garmin-ready `.fit` files you can import into Garmin Connect. The entire conversion runs in the browser so your data never leaves your device.

## Live URLs
- Marketing site & converter: https://trackersync.app/
- Docs & troubleshooting: see `/docs` directory (rendered via site navigation)

## Information Architecture (v1)
- **Top navigation:** Product ▸ Overview, How it works · Converters ▸ Weight, Body fat, BMI, Resting heart rate, Sleep score · Docs · Blog · Pricing · Convert files (CTA)
- **Primary pages:** Home, Product overview, Product → How it works, Converters hub, Weight converter detail, Docs, Blog, Pricing, Contact, Privacy, App (converter UI), 404
- **Coming-soon pages:** Body fat, BMI, Resting heart rate, Sleep score (re-usable template with email capture placeholder)

Each page ships with tailored copy, meta title/description, canonical tags, and JSON-LD where relevant (software application + FAQ).

## Conversion Flow
1. Export Fitbit data with Google Takeout and extract the archive.
2. Locate `Global Export Data/weight-YYYY-MM-DD.json` files.
3. Drag up to three files into the Trackersync converter (`/app` or `/converters/weight`).
4. The browser validates structure, sends them to the API for conversion, and surfaces any issues inline.
5. Download produced `.fit` files and import them via https://connect.garmin.com/modern/import-data.

## Repository Layout
```
frontend/      React + Vite app (marketing pages, converter UI)
backend/       FastAPI service (uploads, validation, conversion)
docs/          Architecture, deployment, troubleshooting, IA notes
wrangler.toml  Cloudflare Pages configuration
```

Key frontend modules:
- `src/components/layout/` — site-wide header, footer, layout shell
- `src/components/converters/` — weight converter React component (shared by weight page and `/app`)
- `src/pages/` — route components (lazy-loaded via `src/router.tsx`)
- `src/services/api.ts` — client for upload/validate/convert/download endpoints

## Local Development
### Frontend
```bash
cd frontend
npm install
npm run dev
```
Vite serves the marketing site at http://localhost:5173 with API calls proxied to `/api`.

### Backend
```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate  # Windows (use bin/activate on macOS/Linux)
pip install -r requirements.txt
uvicorn main:app --reload
```
Backend listens on http://localhost:8000; set `VITE_API_URL=http://localhost:8000` in `frontend/.env` for full-stack local testing.

## Build & Deploy
```bash
cd frontend
npm install
npm run build
npx wrangler pages dev dist            # local Pages preview
npx wrangler pages deploy dist --project-name trackesync --commit-dirty=true
```
- Cloudflare Pages handles static hosting; Functions provide the API shim.
- `wrangler.toml` defines KV (RATE_LIMITS) and R2 (FILE_STORAGE) bindings plus `VITE_API_URL`/`ENVIRONMENT` vars.
- Ensure the backend deployment (FastAPI on Vercel/Cloudflare Workers) matches the URL exposed to the frontend.

## Testing
- Frontend: `npm test` (Jest via react-scripts / Vite config) — keep new tests under `src/**/*.test.ts(x)`.
- Manual QA checklist: upload valid weight JSON, validate partial success handling, confirm download links, and verify canonical/meta tags render via `Helmet`.
- Planned: add `frontend/tests/` coverage for converter happy-path + validation errors.

## Documentation Map
- `docs/ARCHITECTURE.md` — high-level system layout (frontend, API, storage)
- `docs/DEPLOYMENT.md` — Cloudflare Pages setup, bindings, env vars
- `docs/TROUBLESHOOTING.md` — conversion and download issues
- `docs/FITBIT_GOOGLE_TAKEOUT_TO_GARMIN.md` — conversion algorithm notes
- `docs/TRACKERSYNC_SITE_CONTENT.md` — navigation, copy blocks, SEO assets (see new doc)
- `docs/RATE_LIMITING_ARCHITECTURE.md` — fingerprint throttling design

## Support & Operations
- Rate limits: free tier allows two conversions per day; enforcement lives in the backend fingerprint service + KV counters.
- Filenames with spaces are URL encoded client-side and decoded server-side.
- Contact email surfaced on `/contact`: `hello@trackersync.app`.
- Security: no secrets committed; browser-only processing ensures user data stays local.
