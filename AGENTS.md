# Repository Guidelines

## Project Structure & Module Organization
- backend/ — FastAPI service. Key files: `main.py` (routes), `models.py` (Pydantic schemas), `converter.py` (FIT conversion), `fingerprint.py` (rate limits), `api/index.py` (Vercel entry).
- frontend/ — React + TypeScript app. Key paths: `src/components/*`, `src/services/*`, `public/`.
- docs/ — Technical notes about the conversion algorithm.
- Root `package.json` is minimal; use per‑app package files.

## Build, Test, and Development Commands
- Backend (Python 3.10+):
  - Setup: `cd backend && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt`
  - Run (dev): `uvicorn main:app --reload` (serves at `http://localhost:8000`)
  - Vercel: serverless entry at `backend/api/index.py`.
- Frontend:
  - Setup/Dev: `cd frontend && npm install && npm start` (serves at `http://localhost:3000`)
  - Build: `npm run build`
- Environment: set `frontend/.env` with `REACT_APP_API_URL=http://localhost:8000` (or your deployed backend URL). CORS is enabled in backend for local dev.

## Coding Style & Naming Conventions
- Python: 4‑space indentation, PEP 8, type hints. Module names `snake_case.py`; classes `PascalCase`; functions/vars `snake_case`.
  - API IO must use Pydantic models in `models.py`.
  - Keep converter logic isolated in `converter.py`; avoid business logic in route handlers.
- TypeScript/React: functional components, hooks, `.tsx` under `src/`. Components `PascalCase`; functions/vars `camelCase`. Keep API calls in `src/services`.

## Testing Guidelines
- Frontend: run `npm test` (Jest via react‑scripts). Name tests `*.test.ts(x)` near sources.
- Backend: no suite yet. If adding, prefer `pytest` with tests under `backend/tests/` targeting `converter.py` and rate‑limiting logic. Keep tests fast and deterministic.

## Commit & Pull Request Guidelines
- Commits: concise, imperative subject (≤72 chars). Optional scope: `backend:`, `frontend:`. Examples: `backend: add /validate endpoint`, `frontend: show rate limit banner`.
- PRs: include summary, screenshots for UI, steps to run locally, and linked issue. Note breaking changes and config updates (e.g., `.env`, CORS).

## Security & Configuration
- Do not commit secrets or real URLs; `.env*` are git‑ignored. Use `REACT_APP_API_URL` for the frontend and review CORS in `backend/main.py` before production.
