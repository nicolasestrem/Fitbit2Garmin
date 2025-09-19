# [Archived] Project: Fitbit Google Takeout to Garmin Converter

## Project Overview

This project is a web application that converts Fitbit weight data from Google Takeout into Garmin-compatible .fit files. This allows users to migrate their historical weight data from Fitbit to Garmin Connect.

The application consists of a Python FastAPI backend and a React frontend.

**Backend:**

*   **Framework:** FastAPI
*   **Language:** Python
*   **Key Dependencies:**
    *   `fastapi`: For the web framework
    *   `uvicorn`: For the ASGI server
    *   `fit-tool`: For creating .fit files
    *   `python-jose`: For JWTs (not explicitly used in the main flow, but present)
    *   `passlib`: For password hashing (not explicitly used, but present)
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

### Backend (FastAPI)

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
3.  **Run the development server:**
    ```bash
    uvicorn main:app --reload
    ```

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

*   **Backend:** The backend code follows a standard FastAPI structure. It uses Pydantic models for data validation and has a clear separation of concerns between the API endpoints and the conversion logic.
*   **Frontend:** The frontend is a modern React application using functional components and hooks. It uses TypeScript for type safety and Tailwind CSS for styling. The code is organized into components and services.
*   **API:** The API is versioned (v1) and includes endpoints for uploading, validating, converting, and downloading files. It also has a usage endpoint to check the rate-limiting status.

## Configuration

### Daily Conversion Limit

The daily conversion limit is defined in the `backend/fingerprint.py` file. To change the limit, modify the `DAILY_LIMIT` variable:

```python
DAILY_LIMIT = 2  # Free tier: 2 conversions per day
```
