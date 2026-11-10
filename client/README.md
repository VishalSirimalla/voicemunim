# VoiceMunim client

React, TypeScript, Vite, and Tailwind CSS v4 frontend for the VoiceMunim API.

## Run locally

1. Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` if the API is
   not at `http://localhost:5000/api/v1`.
2. Install dependencies with `npm install`.
3. Run `npm run dev`.

The backend must allow the exact Vite origin in its `CORS_ORIGINS` setting.
Tokens are stored in tab-scoped `sessionStorage`; the API currently supports
bearer tokens rather than HttpOnly cookie authentication.

Run `npm run typecheck`, `npm run lint`, and `npm run build` before shipping.
