# Project: Fitbit Google Takeout to Garmin Converter

## Project Overview

This project is a web application that converts Fitbit weight data from Google Takeout into Garmin-compatible .fit files. This allows users to migrate their historical weight data from Fitbit to Garmin Connect.

The application consists of a Cloudflare Functions backend and a React frontend.

**Backend:**

*   **Framework:** Cloudflare Functions
*   **Language:** JavaScript
*   **Key Dependencies:**
    *   `@garmin/fitsdk`: For creating .fit files
*   **Functionality:**
    *   Handles file uploads of Fitbit data (`.json`).
    *   Validates the uploaded files.
    *   Converts the data to `.fit` format.
    *   Provides download links for the converted files.
    *   Implements rate limiting based on user fingerprinting.

**Frontend:**

*   **Framework:** React
*   **Language:** TypeScript
*   **Bundler:** Vite
*   **Key Dependencies:**
    *   `react`: For the UI library
    *   `axios`: For making API requests to the backend
    *   `react-dropzone`: for file uploads
    *   `@fingerprintjs/fingerprintjs`: For browser fingerprinting to identify users for rate limiting.
*   **Functionality:**
    *   Provides a user interface for uploading files.
    *   Displays the progress of the conversion.
    *   Allows users to download the converted files.

## Building and Running

### Backend (Cloudflare Functions)

The backend is implemented as Cloudflare Functions and is tightly integrated with the frontend. The functions are located in the `frontend/functions` directory.

### Frontend (React)

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```

## Development Conventions

*   **Backend:** The backend code is organized as a series of Cloudflare Functions.
*   **Frontend:** The frontend is a modern React application using functional components and hooks. It uses TypeScript for type safety and Tailwind CSS for styling. The code is organized into components and services.
*   **API:** The API is implemented as Cloudflare Functions and includes endpoints for uploading, validating, converting, and downloading files. It also has a usage endpoint to check the rate-limiting status.

## Configuration

### Daily Conversion Limit

The daily conversion limit is defined in the `wrangler.toml` file and managed through Cloudflare's infrastructure.