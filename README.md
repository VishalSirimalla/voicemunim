# VoiceMunim

Voice-first AI-powered business management for Indian Kirana stores.

## Backend

The Node.js/Express backend is in [`server/`](./server). Copy
[`server/.env.example`](./server/.env.example) to `server/.env`, set MongoDB and
JWT configuration, then run:

```sh
cd server
npm install
npm run dev
```

MongoDB must support transactions (for example, MongoDB Atlas or a local replica
set). Configure `CORS_ORIGINS` as a comma-separated allowlist of exact browser
origins. Protected endpoints require a bearer token from registration or login.
All business data is scoped to the authenticated shop.

The API includes inventory, customers and ledgers, sales, payments, dashboard
and report endpoints, and a voice flow with explicit transaction previews and
confirmation. Gnani and Google Gemini Flash are optional providers and require
backend-only environment credentials.

Read [the backend API reference](./docs/backend-api.md),
[backend setup and migration instructions](./docs/backend-setup.md),
[voice workflow details](./docs/voice-workflow.md), and
[frontend integration notes](./docs/frontend-integration.md).

Run API/model tests with `npm test` from `server/`. The replica-set integration
suite is `npm run test:integration`; it requires `MONGODB_TEST_URI` pointed to a
dedicated disposable replica-set database ending in `test` or `_test`. It skips
when the variable is absent.
