# VoiceMunim backend API

All endpoints are relative to `/api/v1`. JSON responses use
`{ "success": true, "data": ... }`; errors use
`{ "success": false, "error": { "message": "..." } }`.
Except for registration and login, API routes require
`Authorization: Bearer <access-token>`. List endpoints accept `page` (default
`1`) and `limit` (default `20`, maximum `100`) unless noted.

## Authentication

- `POST /auth/register` — create a shop and owner account; returns a safe shop
  profile and bearer token.
- `POST /auth/login` — authenticate with `email` and `password`.
- `GET /auth/me` — get the authenticated shop profile.
- `PUT /auth/me` — update shop and owner profile fields.
- `PUT /auth/password` — change password; increments token version and
  invalidates existing access tokens.
- `POST /auth/logout` — informs the client to discard the bearer token. Tokens
  expire automatically; this endpoint does not maintain a server-side token
  denylist.

The authenticated shop is the tenant boundary. Product, customer, transaction,
dashboard, reporting, and voice-action reads/writes are scoped to that shop.
Passwords are hashed with bcrypt; access tokens are signed using
`JWT_SECRET`. Use a random secret of at least 32 characters and configure
`JWT_EXPIRES_IN` as needed.

## Inventory

- `GET /products?search=&category=&page=&limit=`
- `POST /products` with `name`, `price`, and `unit`; optional `category`,
  `stock`, and `lowStockThreshold`.
- `GET /products/:id`
- `PUT /products/:id` to update product details. Stock cannot be changed here.
- `DELETE /products/:id`; products with transaction history cannot be deleted.
- `POST /products/:id/stock` with
  `{ "type": "STOCK_IN", "quantity": 10 }` or
  `{ "type": "STOCK_ADJUSTMENT", "quantity": 2, "direction": "REMOVE" }`.
  This endpoint requires an `Idempotency-Key` header. Initial stock can be set
  when a product is created. Stock quantities support up to three decimal
  places and are limited to `100000`.

## Customers and ledger

- `GET /customers?search=&page=&limit=`
- `POST /customers` with `name` and `phone` (normalized phone numbers are unique
  within a shop).
- `GET /customers/:id`
- `PUT /customers/:id`
- `GET /customers/:id/ledger` — outstanding balance and paginated sale/payment
  history.

## Sales and payments

- `GET /sales?page=&limit=`
- `POST /sales` with `items: [{ "productId": "...", "quantity": 2 }]`; optional
  `customerId`, `amountPaid`, and `paymentMethod` (`CASH`, `UPI`, `CARD`, or
  `OTHER`). Product prices are read from MongoDB, stock is decremented within a
  transaction, and credit sales require a customer. A sale accepts at most 50
  items; each quantity must be positive, no greater than `100000`, and use no
  more than three decimal places. Money is calculated in integer paise and
  rounded per line. Zero-value sale totals are rejected. A payment method is
  required when `amountPaid` is positive and is rejected when it is zero.
- `GET /sales/:id`
- `POST /payments` with `customerId`, positive `amount`, and `paymentMethod`.
  Payments cannot exceed the customer's outstanding balance and are allocated
  to the oldest unpaid sales first.

Every sale, payment, or stock adjustment request must include a unique
`Idempotency-Key` header (up to 128 URL-safe characters). Retrying the same key
with the same request returns the original transaction; reusing it for different
request data returns `409 Conflict`. Idempotency keys are unique within a shop.
Transaction-backed endpoints require MongoDB transactions (a replica set such
as MongoDB Atlas); deleting a product also uses a transaction to avoid racing
with a sale.

## Dashboard and reports

- `GET /dashboard/summary` — shop-level counts, today's/month's sales,
  collections, outstanding balance, low-stock count, and recent/top products.
- `GET /dashboard/sales-chart?period=daily|weekly|monthly` or
  `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` — sales and collections grouped by
  business-local date.
- `GET /dashboard/low-stock?page=&limit=`
- `GET /reports/sales?period=...` — sales totals and sales in the selected date
  range.
- `GET /reports/daily` — current business-local day's sales, collections, and
  outstanding totals.
- `GET /reports/collections?period=...` — collections grouped by date.
- `GET /reports/outstanding` — outstanding balance by customer.
- `GET /reports/inventory?page=&limit=` — inventory totals and products.
- `GET /reports/top-products?period=...&limit=` — ranked products in a date
  range.
- `GET /reports/low-stock?page=&limit=`

For report and chart routes, replace `period` with a paired `startDate` and
`endDate` when requesting a custom range. Custom ranges are inclusive and are
limited to 366 days. Dates are interpreted in the shop's configured IANA
business timezone.

## Voice

- `POST /voice/transcribe` — multipart field `audio` (up to 10 MB) and optional
  `languageCode`; returns a transcription from Gnani Prisma v2.5 (the transcript
  may be empty when the audio contains no speech).
- `POST /voice/interpret` — JSON `{ "transcription": "..." }`; returns intent,
  answers safe read-only business queries, or creates a pending action preview.
- `POST /voice/process` — multipart `audio` and optional `languageCode`; runs
  transcription and intent processing in one request; returns `422` when no
  speech is detected.
- `POST /voice/confirm` — JSON `{ "actionId": "..." }`; executes a pending
  sale/payment only after explicit confirmation. If prices, stock, or balances
  have changed, responds `409` with a refreshed preview that must be confirmed
  again.
- `POST /voice/cancel` — JSON `{ "actionId": "..." }`; cancels a pending action.
- `POST /voice/speak` — JSON `text` and optional `language`, `voice`, `container`;
  responds with audio synthesized by Gnani Timbre v2.5.

Voice sale prices and current inventory/customer balances come from MongoDB;
AI output never supplies authoritative prices or causes a financial mutation
without an explicit confirmation. Pending previews expire after ten minutes.
Configure `GEMINI_API_KEY` and optional `GEMINI_MODEL` (defaults to
`gemini-2.5-flash`) for intent extraction. The application does not fabricate
responses when a provider is unavailable.

## CORS, setup, and validation

Set `CORS_ORIGINS` to a comma-separated list of exact allowed browser origins.
When empty, browser origins are denied. Requests without an `Origin` header
(for example, server-to-server requests) are allowed.

Copy `server/.env.example` to `server/.env` and set MongoDB, JWT, allowed origins,
and optional provider variables. Never commit `.env` or expose provider/JWT
secrets in frontend code. See [backend setup](./backend-setup.md) for tenant
migration instructions and [voice workflow](./voice-workflow.md) for provider
configuration and safety details.

Run `npm test` from `server/` for API/model tests. `npm run test:integration`
requires `MONGODB_TEST_URI` connected to a replica set, with a dedicated database
whose name ends in `test` or `_test`; otherwise the integration test is skipped.
The integration suite creates and deletes only its own test shops and data.
