# Backend setup and tenant migration

## Local configuration

From `server/`, copy `.env.example` to `.env`, set `MONGODB_URI` (or the legacy
`MONGO_URI`), and set a random `JWT_SECRET` of at least 32 characters. Configure
`CORS_ORIGINS` as a comma-separated list of exact browser origins. Do not commit
`.env`, paste credentials into issue trackers, or put provider secrets in the
client bundle.

```sh
npm install
npm run dev
```

MongoDB must support transactions (for example, Atlas or a local replica set).
The API initializes schema indexes when it connects.

## Assigning existing records to shops

Legacy products, customers, and transactions have no safe implicit owner. Before
deploying the tenant-scoped API to a database with legacy records:

1. Stop the API and take a verified database backup.
2. Create shop accounts and determine the correct owner for every legacy
   product, customer, and transaction. Do not assign records to an arbitrary
   shop.
3. Prepare a reviewed JSON file with the following shape. Map every legacy
   record that does not already have `shopId` to an existing Shop ObjectId.
   The keys are record ObjectIds; values are Shop ObjectIds.

   ```json
   {
     "products": { "<product-id>": "<shop-id>" },
     "customers": { "<customer-id>": "<shop-id>" },
     "transactions": { "<transaction-id>": "<shop-id>" }
   }
   ```

4. Set `TENANT_MIGRATION_MAP` to the mapping file path and `MONGODB_URI` to the
   intended database in the process environment. The migration script does not
   load `.env` automatically. Run the dry run first:

   ```sh
   node scripts/migrate-tenant-data.js
   ```

   It validates that records have explicit ownership, shops exist, normalized
   customer phone numbers are unique within each shop, and idempotency keys
   will not collide. It also derives legacy sale-time `initialAmountPaid` from
   existing payment allocations.

5. After reviewing the output and backup, apply the mapping:

   ```sh
   node scripts/migrate-tenant-data.js --apply
   ```

The script updates ownership/normalized fields, backfills historical
sale-time collections, and replaces legacy global customer-phone and
idempotency indexes with tenant-scoped indexes. It is intentionally not run
automatically by the API. If a mapping is incomplete, ownership is ambiguous,
or a unique constraint would be violated, migration stops before writing.

## Tests

`npm test` runs tests that do not need MongoDB. For real transaction and
multi-tenant integration coverage, point `MONGODB_TEST_URI` to a disposable
replica-set database whose name ends with `test` or `_test`, then run:

```sh
npm run test:integration
```

The suite creates test accounts and records, exercises actual API requests and
transactions, then removes those test records. Do not point it at production or
a database containing user data.
