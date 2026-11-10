# Frontend integration notes

- Register or log in using `/api/v1/auth/register` or `/api/v1/auth/login`.
  Store the returned bearer token using the frontend's secure session strategy
  and send it as `Authorization: Bearer <token>` on protected requests.
- Use `server/.env` only on the backend. Do not bundle `JWT_SECRET`,
  `GNANI_API_KEY_ID`, or `GEMINI_API_KEY` into the frontend.
- Set backend `CORS_ORIGINS` to the frontend's exact deployed origin(s). Include
  scheme and port where applicable; wildcard origins are not supported.
- For typed sales, send `POST /api/v1/sales` with product IDs and quantities
  plus a unique `Idempotency-Key`. The backend returns prices from its database.
- For voice, upload a supported audio file as multipart field `audio` to
  `/api/v1/voice/process`, or submit a transcript as JSON to `/voice/interpret`.
  Show the returned preview and require a separate user action to call
  `/voice/confirm`. If confirmation responds `409` with a refreshed preview,
  show the updated details and obtain confirmation again.
- The client should treat `401` as an expired/invalid login, `403` as a
  disallowed browser origin, `409` as a conflict requiring user action, and
  `5xx` as a provider/server failure. Never interpret a failed response as
  successful sale or payment.
- If an API request returns `401 Authentication required`, the client did not
  send a bearer token. Registration and login both return the token at
  `data.token`; check for a successful login response and attach
  `Authorization: Bearer <data.token>` before calling `/voice/interpret`.
- Reports accept shop-local date ranges in `YYYY-MM-DD` form. Both
  `startDate` and `endDate` must be supplied, and ranges cannot exceed 366 days.

See [API reference](./backend-api.md) for all endpoints and request shapes.
