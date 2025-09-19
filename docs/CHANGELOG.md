# Changelog

2025-09-20

- Fix Cloudflare Pages routing so /api hits Functions (avoid SPA catch‑all)
- Add _routes.json include /api/*; update _redirects and dist copies
- Align wrangler.toml with frontend/dist; add nodejs_compat flag
- Set TS target ES2020 to avoid ES5 transform errors in Functions bundling
- Rework conversion to use @garmin/fitsdk Encoder (no streams), build FILE_ID + WEIGHT_SCALE messages and close() to bytes
- Enable conversion on Functions; store FIT bytes in R2 under converted/{conversion_id}/
- Fix sort comparator bug (timestamp) causing 500s
- Fix download of filenames with spaces via encodeURIComponent/decodeURIComponent
- Surface API error details in frontend for 5xx responses
- Document environment via wrangler.toml [vars]; Secrets via Dashboard
- Add tested/ with proven Python batch converter for reference
- Archive legacy docs under /archives and add consolidated documentation under /docs
