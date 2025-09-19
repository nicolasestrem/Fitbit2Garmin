# Troubleshooting

Routing

- Symptom: API calls return index.html or 405/404
  - Ensure frontend/public/_redirects has /api/* before the SPA rule
  - Ensure _routes.json includes only /api/*
  - Confirm Functions directory is frontend/functions in Pages settings

Bundling / ESM

- Symptom: "No matching export for import default" from @garmin/fitsdk
  - Use dynamic import and named exports; avoid default import
- Symptom: ES5 transform errors (async/await, const, for-of)
  - Set frontend/tsconfig.json target to ES2020

FIT encoding

- Symptom: encoder.pipe is not a function
  - Use Encoder.writeMesg(...) and Encoder.close() to get Uint8Array
- Symptom: data imported but not visible in Garmin
  - Ensure timestamps are correct and units are accurate (see docs/FITBIT_GOOGLE_TAKEOUT_TO_GARMIN.md)

Downloads

- Symptom: Download 404 for files with spaces
  - Client: encodeURIComponent(filename)
  - Server: decodeURIComponent(path segment) before lookup and R2 get

R2 / KV bindings

- Symptom: Cannot read properties of undefined (e.g., env.FILE_STORAGE)
  - Add bindings in wrangler.toml and Pages GUI
  - Confirm bucket name and KV namespace IDs

Verification checklist

- Upload succeeds (200), JSON validated
- Convert returns conversion_id, files list, total_entries, download_urls
- Download returns application/octet-stream with Content-Disposition
