# Trackersync Site Content & SEO Reference

This document centralises the copy, structure, and structured-data assets for the Trackersync marketing site.

## 1. Global Navigation
- **Brand/home:** Trackersync logo → `/`
- **Product:** `/product`
  - Overview → `/product`
  - How it works → `/product/how-it-works`
- **Converters:** `/converters`
  - Weight (live) → `/converters/weight`
  - Body fat (coming soon) → `/converters/body-fat`
  - BMI (coming soon) → `/converters/bmi`
  - Resting heart rate (coming soon) → `/converters/resting-heart-rate`
  - Sleep score (coming soon) → `/converters/sleep-score`
- **Docs:** `/docs`
- **Blog:** `/blog`
- **Pricing:** `/pricing`
- **Primary CTA:** Convert files → `/app`

## 2. Homepage (`/`)
- **H1:** Move your health data where you need it
- **Subhead:** Trackersync turns Fitbit Google Takeout files into Garmin-ready `.fit` files. Keep your weight history in Garmin Connect.
- **CTAs:** Convert your files (primary) · See how it works (secondary)
- **Problem statement:** Garmin blocks third-party writes; Trackersync generates clean `.fit` files for manual import.
- **Feature grid:** Google Takeout support · Correct timestamps · Body fat preserved · Browser-only · Free tier (2 files per day)
- **How it works steps:** Export → Upload (up to two `weight-YYYY-MM-DD.json`) → Download `.fit` → Import into Garmin Connect.
- **Current converter:** Weight (kg/lb, body fat when present)
- **Coming soon:** Body fat, BMI, Resting heart rate, Sleep score
- **Privacy:** Local-only processing; no account required
- **Pricing:** Free (2 files/day) · Pro (batch & higher limits, coming soon)
- **FAQ:** JSON file location · Garmin compatibility · Overwrite safety · File size guidance · Data retention
- **Footer legal:** Fitbit and Garmin are trademarks of their owners. Trackersync is independent.

## 3. Converters Hub (`/converters`)
- **Intro:** Weight live today; more series coming.
- **Cards:**
  - Weight `.json -> .fit` (Convert now CTA)
  - Body fat, BMI, Resting heart rate, Sleep score (Learn more → respective coming-soon pages)

## 4. Weight Converter (`/converters/weight`)
- **H1:** Fitbit Google Takeout -> Garmin weight (.fit)
- **Why it matters / What you need / Steps / What the tool keeps / Notes** — all surfaced as cards.
- **Inline converter:** Embeds `WeightConverterApp` with upload, validation, progress, downloads.
- **Mini-FAQ:** Garmin device requirement, deleting bad imports.
- **Structured data:** FAQ JSON-LD included via Helmet.

## 5. Converter Coming-Soon Template
Used by `/converters/body-fat`, `/converters/bmi`, `/converters/resting-heart-rate`, `/converters/sleep-score`.
- Dynamic meta title + canonical based on slug.
- Copy: emphasises upcoming support, lists benefits (dates/times preserved, clean `.fit`, local processing).
- Disabled email capture block (UI placeholder).
- Related guides: exporting Fitbit data, importing `.fit` into Garmin.
- CTA back to weight converter.

## 6. Product Pages
- **Overview (`/product`):** Value proposition, key capabilities, why it matters, roadmap pointer to converters.
- **How it works (`/product/how-it-works`):** Four-step walkthrough from Google Takeout export to Garmin import, with link to docs.

## 7. Resource Pages
- **Docs (`/docs`):** Lists topics for deeper guides.
- **Blog (`/blog`):** Seeded outlines for initial posts (Garmin policy, step-by-step guide, .fit format explainer).
- **Pricing (`/pricing`):** Free vs Pro (coming soon).
- **Contact (`/contact`):** Support email `hello@trackersync.app`.
- **Privacy (`/privacy`):** Local processing policy, no data storage.
- **App (`/app`):** Direct access to the converter UI.
- **404:** Friendly redirect to home/converters.

## 8. SEO & Metadata
- **Base head (`frontend/index.html`):** Title, description, canonical, Open Graph/Twitter tags, SoftwareApplication + FAQ JSON-LD.
- **Per-page metadata:** Each `Helmet` instance provides title, description, and canonical. Weight page adds FAQ JSON-LD. Coming-soon canonical computed per slug.
- **Sitemap/robots:** TODO — generate via build step (tracked in deployment backlog).
- **Cache-control:** Configure via Cloudflare Pages (see `docs/DEPLOYMENT.md`).

## 9. Styling System
- Header + footer replicate Cloudflare-ready palette: root CSS variables defined in `SiteHeader.css`, layout spacing in `SiteLayout.css`.
- Typography + spacing rely on Tailwind utility classes; no global Tailwind reset beyond `index.css`.
- Mobile navigation uses checkbox toggle; dropdowns open on hover/focus.

## 10. Future Work
- Enable live email capture with provider integration when ready.
- Add structured data for upcoming converters once launched.
- Automate sitemap/robots generation and include blog post metadata as content ships.
- Expand tests around `WeightConverterApp` to cover validation errors and partial success states.
