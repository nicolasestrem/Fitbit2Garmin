# [Archived] Cloudflare Pages Migration Documentation

## Overview

Successfully migrated the Fitbit2Garmin application from Vercel to Cloudflare Pages. The application now runs entirely on Cloudflare's infrastructure using Pages for static hosting and Pages Functions for API endpoints.

## Migration Summary

### What Was Done

1. **Fixed Cloudflare Pages Build Configuration**
   - Updated `wrangler.toml` to use Pages-specific settings
   - Added `pages_build_output_dir = "frontend/build"`
   - Removed Workers-specific configurations (`main`, `build`)

2. **Migrated API Backend**
   - Created Cloudflare Pages Functions in `/functions/api/[[path]].js`
   - Implemented basic API routing and CORS handling
   - Replaced external Vercel API dependency

3. **Updated Frontend Configuration**
   - Modified `_redirects` file to remove external API proxying
   - Pages Functions now handle `/api/*` routes automatically

## Current Deployment Status

### ✅ Working Components

- **Frontend**: React application builds and deploys successfully
- **Static Hosting**: Cloudflare Pages serves the React build
- **Basic API**: Pages Functions respond to API requests
- **CORS**: Cross-origin requests are properly handled
- **Routing**: SPA routing works correctly

### 🚧 In Progress / Not Yet Implemented

The following API endpoints return "not yet implemented" responses:

- `POST /api/upload` - File upload handling
- `POST /api/validate` - File validation
- `POST /api/convert` - Fitbit to Garmin conversion
- `GET /api/download/{id}/{filename}` - File downloads

### ✅ Mock Endpoints Working

- `GET /api/` - Health check (returns API status)
- `GET /api/usage/{hash}` - Usage limits (returns mock data)

## Deployment URLs

- **Latest**: https://8559886d.fitbit2garmin.pages.dev
- **Branch URL**: https://fix-vercel-build-and-routing.fitbit2garmin.pages.dev

## Configuration Files

### wrangler.toml
```toml
name = "fitbit2garmin"
pages_build_output_dir = "frontend/dist"
compatibility_date = "2023-12-01"

[vars]
ENVIRONMENT = "production"

[[kv_namespaces]]
binding = "RATE_LIMITS"
id = "cdaa358255684b39b8f9429dab347cec"
```

### Routing fixes

To ensure API requests are handled by Cloudflare Pages Functions and not the SPA, two routing files are required:

1) `_redirects` (copied to the build output)
```
# Ensure API requests hit Pages Functions first
/api/*    /api/:splat   200

# SPA routing for React Router
/*         /index.html   200
```

2) `_routes.json` (placed alongside the static assets)
```
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": []
}
```

Previously, the catch‑all SPA rule caused `/api/*` to be rewritten to `/index.html`. The above configuration ensures `/api/*` is evaluated as a function route and the SPA receives everything else.

## Next Steps for Full Functionality

To complete the migration and restore full functionality:

### 1. Implement File Upload (Priority: High)
```javascript
// In functions/api/[[path]].js - handleUpload()
- Parse multipart/form-data
- Validate file types (.json only)
- Store uploaded data temporarily (KV or R2)
```

### 2. Implement File Conversion (Priority: High)
```javascript
// Convert Python converter.py logic to JavaScript
- Parse Fitbit JSON format
- Generate Garmin .fit files
- Use fit-file-writer or similar JavaScript library
```

### 3. Set Up KV Storage for Rate Limiting (Priority: Medium)
```javascript
// Use existing KV namespace binding: RATE_LIMITS
- Store user fingerprints and usage counts
- Implement daily limits (2 conversions per day)
- Track IP addresses for abuse prevention
```

### 4. Implement File Storage (Priority: Medium)
```javascript
// Options for converted file storage:
- Cloudflare R2 (Object Storage)
- KV with base64 encoding (for small files)
- Temporary in-memory storage
```

## Build and Deployment Commands

```bash
# Build frontend (installs UI deps, builds, then installs Functions deps)
cd frontend && npm ci && npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy frontend/dist --project-name=fitbit2garmin --commit-dirty=true

# Check deployment status
npx wrangler pages deployment list --project-name=fitbit2garmin

### Pages GUI Build Settings

- Root directory: `frontend`
- Build command: `npm ci && npm run build`
- Build output directory: `dist`
- Functions directory: `frontend/functions`

Important build fixes

- Set `frontend/tsconfig.json` target to `ES2020` to prevent ES5 downleveling errors during Functions bundling.
- Ensure Functions dependencies install during `postbuild` with `cd functions && npm ci` (see `frontend/package.json`).
```

## Monitoring and Debugging

- **Build logs**: Available in Cloudflare Dashboard
- **Function logs**: `wrangler pages deployment tail`
- **Local development**: `wrangler pages dev frontend/dist`

## Architecture Changes

### Before (Vercel)
```
Frontend (React) -> Vercel Static
API (FastAPI/Python) -> Vercel Serverless Functions
Storage -> In-memory (temporary)
Rate Limiting -> Python fingerprinting service
```

### After (Cloudflare)
```
Frontend (React) -> Cloudflare Pages
API (JavaScript) -> Cloudflare Pages Functions
Storage -> Cloudflare KV + R2 (planned)
Rate Limiting -> KV-based fingerprinting (planned)
```

## Performance Benefits

- **Global CDN**: Cloudflare's edge network
- **Faster cold starts**: JavaScript Functions vs Python
- **Integrated platform**: No cross-service API calls
- **Better caching**: Built-in edge caching

## Troubleshooting

### Common Issues

1. **Build fails with "react-scripts not found"**
   - Solution: Ensure build command includes `cd frontend && npm install`

2. **Functions not deploying**
   - Check `/functions` directory is in project root
   - Verify function syntax and exports

3. **CORS errors**
   - Ensure `corsHeaders` are included in all responses
   - Handle OPTIONS preflight requests

### Testing Endpoints

```bash
# Test API health
curl https://8559886d.fitbit2garmin.pages.dev/api/

# Test usage endpoint
curl https://8559886d.fitbit2garmin.pages.dev/api/usage/test123

# Test upload (should return 501 - not implemented)
curl -X POST https://8559886d.fitbit2garmin.pages.dev/api/upload
```

---

**Migration Status**: ✅ Phase 1 Complete - Infrastructure and basic API
**Next Phase**: Implement core conversion functionality
**Timeline**: Basic functionality can be restored within 1-2 development sessions
