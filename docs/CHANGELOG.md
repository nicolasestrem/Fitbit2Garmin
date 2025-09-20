# Changelog

2025-09-20

## Major Feature: Measurements Tabs Interface

- **feat**: Add comprehensive tab-based interface for multiple measurement types
- **feat**: Implement React Router v7 with nested routes for measurements (/measurements/weight, /measurements/heart-rate, etc.)
- **feat**: Add react-helmet-async for SEO optimization with unique meta tags per measurement
- **feat**: Create accessible tabs component with ARIA compliance and keyboard navigation (arrow keys, Home/End)
- **feat**: Build responsive design with horizontal tabs on desktop, select dropdown on mobile
- **feat**: Add 9 "Coming soon" measurement pages with unique SEO content and FAQ structured data
- **feat**: Extract weight conversion logic to dedicated WeightPage while maintaining full backward compatibility
- **feat**: Implement central measurements registry for easy addition of new measurement types
- **feat**: Add JSON-LD structured data for FAQ sections on each measurement page
- **feat**: Create cross-measurement navigation and internal linking strategy
- **feat**: Support partial_success state in ConversionProgress component
- **docs**: Add comprehensive implementation guide at docs/MEASUREMENTS_TABS_INTERFACE.md
- **perf**: Implement lazy loading for measurement pages with code splitting
- **a11y**: Full WCAG 2.1 AA compliance with keyboard navigation and screen reader support

## Previous Changes

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
