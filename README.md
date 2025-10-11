# TrackerSync: Fitbit to Garmin Data Converter

**TrackerSync** is a web-based tool that converts your Fitbit data from a Google Takeout export into Garmin-compatible `.FIT` files. This allows you to seamlessly migrate your historical health and fitness data when switching from a Fitbit device to a Garmin device, preserving your long-term trends and insights.

**➡️ Live App: [https://trackersync.app](https://trackersync.app)**

---

## Features

- **Google Takeout Compatibility**: Directly processes `JSON` files from your Fitbit Google Takeout export.
- **Accurate Conversions**: Uses the official `@garmin/fitsdk` to generate valid and accurate `.FIT` files.
- **Multiple Data Types**: Supports conversion for various health metrics (see "Supported Data" below).
- **Batch Processing**: Upload and convert multiple files at once.
- **Serverless Architecture**: Runs entirely on the Cloudflare ecosystem (Pages, Functions, R2, D1, and KV) for high availability and scalability.
- **Secure & Private**: Your health data is processed securely and is not stored long-term.
- **User-Friendly Interface**: Simple, step-by-step process to convert and download your data.

## Supported Data Types

| Data Type | Status | Description |
| :--- | :--- | :--- |
| **Weight** | ✅ **Live** | Converts weight, body fat, and timestamps. |
| **Heart Rate** | 🟡 **Coming Soon** | Will convert resting HR, and daily/intraday HR data. |
| **Steps** | 🟡 **Coming Soon** | Will convert daily and intraday step counts. |
| **Sleep** | 🟡 **Coming Soon** | Will convert sleep stages, duration, and quality scores. |
| **VO2 Max** | 🟡 **Coming Soon** | Will convert Cardio Fitness Score to VO2 Max estimates. |
| **Blood Pressure** | 🟡 **Coming Soon** | Will convert systolic and diastolic measurements. |

## How to Use the App

1.  **Export Your Data**: Go to [Google Takeout](https://takeout.google.com) and export your "Fitbit" data. You will receive a `.zip` file.
2.  **Locate Your Files**: Unzip the downloaded file. Navigate to the `Takeout/Fitbit/Global Export Data/` directory to find your `weight-YYYY-MM-DD.json` files.
3.  **Upload**: Go to [trackersync.app](https://trackersync.app), select the "Weight" tab, and upload your `.json` files.
4.  **Convert**: Click the "Convert" button to process the files.
5.  **Download & Import**: Download the generated `.FIT` files and import them into Garmin Connect via the "Import Data" feature in the web settings.

## Technology Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Cloudflare Pages Functions (JavaScript)
- **Storage**:
    - **R2**: For temporary file uploads and converted `.FIT` files.
    - **D1**: For atomic rate limiting and user pass management.
    - **KV**: For caching rate limit data and session information.
- **Payments**: Stripe for handling premium passes.

## Project Structure

```
.
├── docs/                # Detailed architecture, deployment, and troubleshooting guides
├── frontend/
│   ├── functions/       # Cloudflare Pages Functions (the serverless backend)
│   │   └── api/         # API route handlers
│   ├── src/             # Frontend React application source code
│   │   ├── components/  # Reusable React components
│   │   ├── pages/       # Page components corresponding to routes
│   │   ├── services/    # Services for API communication, payments, etc.
│   │   └── utils/       # Utility functions (SEO, analytics, etc.)
│   └── tests/           # Vitest tests for the frontend
└── wrangler.toml        # Cloudflare configuration file
```

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) (or your preferred package manager)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) for running locally and deploying.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-repo/trackersync.git
    cd trackersync
    ```

2.  **Install frontend dependencies:**
    ```bash
    cd frontend
    npm install
    ```

### Running Locally

You can run the frontend and backend separately or together using Wrangler.

**1. Frontend Only (Vite Dev Server)**

This is best for UI development. It will not run the backend Cloudflare Functions.

```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`.

**2. Full Stack (Wrangler Dev Server)**

This runs the full application, including the serverless backend functions. This requires you to have your Cloudflare environment configured locally.

First, build the frontend:
```bash
cd frontend
npm run build
```

Then, run the Pages dev server from the root directory:
```bash
npx wrangler pages dev frontend/dist
```

The full application will be available at `http://localhost:8788`.

### Configuration

The application uses `wrangler.toml` for Cloudflare configuration and a `.dev.vars` file for local secrets.

1.  **Create `.dev.vars`**: In the root directory, create a file named `.dev.vars`.
2.  **Add Secrets**: Add your Stripe secret keys to this file for local development:
    ```
    STRIPE_SECRET_KEY="sk_test_..."
    STRIPE_WEBHOOK_SECRET="whsec_..."
    ```
3.  **Bindings**: The `wrangler.toml` file defines the bindings for KV, D1, and R2. Wrangler will create local versions of these resources when you run `wrangler pages dev`.

## Deployment

Deployment is handled via the Wrangler CLI. See `docs/DEPLOYMENT.md` for detailed instructions.

A typical deployment command looks like this:
```bash
# First, build the frontend application
cd frontend
npm run build

# Deploy to Cloudflare Pages from the root directory
npx wrangler pages deploy frontend/dist --project-name=trackersync
```

## Documentation

For more in-depth information, please refer to the `docs/` directory:

- `docs/ARCHITECTURE.md`: System design, API structure, and storage schema.
- `docs/DEPLOYMENT.md`: Detailed deployment and environment setup guide.
- `docs/TROUBLESHOOTING.md`: Common issues and solutions.
- `docs/CHANGELOG.md`: A log of changes and new features.

---

This project is an independent tool and is not affiliated with, endorsed by, or in any way officially connected with Fitbit, Google, or Garmin Ltd.