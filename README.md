# MobiDuka POS

MobiDuka is a multi-tenant, offline-first commerce platform for kiosks, mini-shops, pharmacies, agrovets, convenience stores, and growing multi-branch retailers. It combines a Next.js web application and API layer with a separate Flutter mobile terminal for Android and iOS workflows.

The platform is designed around reliable retail operations: sales continue during connectivity interruptions, local transactions remain queued until synchronization succeeds, and tenant-scoped access controls protect business data.

## Core capabilities

| Capability | Description |
| --- | --- |
| Offline-first SQLite cache | The Capacitor app can bulk-download supported POS, recent receipt history, dashboard, the More-screen profile/notification overview, shift history, inventory, reports, customer and credit-account lists plus each customer's latest 20 sales and credit entries, role and permission summaries, accepted payment method status, a limited employee directory, user profile, receipt preview configuration, tax settings, a limited settings overview, expense, supplier, purchase-order, and notification data to SQLite from On-device Sync. Inventory displays its snapshot time when offline and is read-only until connectivity returns. POS identifies when it is using saved catalog data and shows the catalog save time; local sales update cached stock without changing that save time. The app records offline cash sales and new cash expenses durably for later synchronization; On-device Sync lists up to the 50 most recent unsent cash sales, their pending/failed state, and the saved failure reason when present. It also shows dataset-level download progress and failures, a saved-data readiness summary with snapshot timestamps, and an estimate of collection-cache and queued-record JSON payload bytes. The estimate excludes PIN-roster data and SQLite overhead, and is not a device or cloud quota. Receipt history includes saved server receipts and locally queued sales labeled by sync state. This does not make every workflow offline: older customer/credit histories and all writes other than cash sales and new cash expenses still require connectivity. Cloud backups, CSV export, and cache clearing are not implemented. Payment account details and credentials are not cached. |
| Idempotent synchronization | Uploads queued records when connectivity returns while preserving tenant context and retrying failed records safely. |
| Offline cash expenses | The Capacitor app saves new cash expenses to SQLite for later synchronization, and shows pending or failed state. Expense edits and non-cash expenses still require an online session. |
| M-Pesa payment processing | Supports server-side Daraja payment workflows and status polling for point-of-sale confirmation. |
| SmartScan | Uses the device camera to read retail barcodes such as EAN-13 and UPC-A, plus structured customer account QR codes. In the Capacitor app, barcode lookup can fall back to the saved product catalog; offline lookups are not recorded as server scan activity. Restocking and adding products still require connectivity, while cached products can be added to the existing offline cash-sale flow. |
| Bluetooth receipts | Supports local thermal receipt printing through Bluetooth-compatible ESC/POS printers. |
| Reports and analytics | Provides tenant-scoped revenue, cost, expense, inventory valuation, low-stock, cash-session, and profitability metrics. |

## Security model

MobiDuka uses business-scoped authentication and five role tiers:

| Role | Primary scope |
| --- | --- |
| `ADMIN` | Platform-level support and operational oversight. |
| `OWNER` | Full business access, including settings and profitability data. |
| `SUPERVISOR` | Store operations, inventory, suppliers, and purchase orders. |
| `CASHIER` | POS sales, permitted expenses, and cash-session workflows. |
| `ACCOUNTANT` | Sales, expenses, cash sessions, and financial review. |

Employee PINs are hashed before database storage. PIN validation and roster access are scoped to the active business. The Capacitor app may cache PIN hashes in its app-private SQLite database for business-scoped offline login; offline PIN access expires after seven days and is protected by a local five-attempt lockout. An offline login is local-only and must be followed by an online sign-in before queued sales synchronize. Staff changes and PIN revocations cannot be enforced on disconnected devices until roster refresh. Never commit PINs, tokens, payment credentials, or database connection strings.

## Project overview

- `app/` – Next.js App Router shell, API routes, and screen pages
- `app/components/` – POS, dashboard, inventory, customer, reporting, settings, suppliers, and other UI screens
- `app/api/` – backend API endpoints for authentication, inventory, sales, sync, cash sessions, and purchase orders
- `app/api-docs/` – Swagger docs route
- `public/openapi.json` – OpenAPI specification used by the docs UI
- `public/swagger-ui/` – local Swagger UI assets served from the app origin
- `prisma/` – Prisma schema, migrations, and seed scripts
- `flutter_app/` – Flutter implementation for mobile/native experimentation and APK/iOS build workflows
- `android/`, `ios/` – native platform projects used by Capacitor and mobile build tooling

## Hardware integrations

### SmartScan camera engine

The mobile terminal uses the camera for product and customer identification:

- Retail product codes, including EAN-13 and UPC-A, can be matched against the active product catalog.
- In the Capacitor app, SmartScan can look up barcodes from the saved inventory/POS catalog when the server is unreachable. It shows the snapshot save time when available, and offline lookup results do not update server scan activity.
- Restocking and creating products require connectivity. A cached product can be added to POS, where the existing offline cash-sale queue applies.
- Customer QR payloads use approved formats such as `MOBIDUKA:USER:<customer-id>` and `CUST_<customer-id>`.
- Successful scans can provide haptic feedback and attach a matching product or customer to the active workflow.
- QR codes must not contain passwords, PINs, JWTs, or payment credentials.

### Bluetooth thermal printing

Receipts can be sent to paired Bluetooth thermal printers using ESC/POS-compatible output. Pair the printer in the device settings, select it in the application, and print a test receipt before store operations begin. Receipt data should be treated as a transaction snapshot and must not expose secrets.

## Web app (Next.js)

The Next.js app is the primary product shell for browser-based usage and API orchestration.

### Run locally

```bash
pnpm install
pnpm dev
```

Then open:

```text
http://localhost:3000
```

### Production build

```bash
pnpm build
pnpm start
```

## API documentation

The API reference is served through a local Swagger UI instance and is available at:

```text
http://localhost:3000/api-docs
```

This page loads the OpenAPI file from `public/openapi.json` and renders the current backend contract for:

- auth/login
- cash/session
- customers
- customers/credit
- employees
- expenses
- payments/mpesa-callback
- payments/stk-push
- payments/stk-query
- purchase-orders
- reports/summary
- sales
- sync

The Swagger UI assets are bundled locally under `public/swagger-ui/` so the docs render reliably without CDN dependency issues.

## Prisma and database sync

The project uses Prisma with PostgreSQL. Set `DATABASE_URL` to the pooled PostgreSQL connection string in local development and in Vercel Project Settings. The canonical schema lives in `prisma/schema.prisma`.

For a new database, bootstrap the current schema once before deploying API routes:

```bash
DATABASE_URL="postgresql://user:password@host:5432/mobiduka?sslmode=require" pnpm exec prisma db push
```

In Vercel, add the same connection string as the `DATABASE_URL` environment variable for every environment that serves the API. Do not rely on `prisma/dev.db`; a Vercel function filesystem is not a durable application database.

The M-Pesa tenant-integration migration is tracked at `20261002000000_add_mpesa_integrations`.

- For an existing database that predates this feature, apply it with `pnpm exec prisma migrate deploy`.
- For a database already synchronized with the current schema using `prisma db push`, record the matching migration with `pnpm exec prisma migrate resolve --applied 20261002000000_add_mpesa_integrations`.

Do not run both commands against the same already-synchronized database: `migrate deploy` would try to create objects that already exist.

### Common commands

```bash
npx prisma generate
npx prisma db push
npx prisma validate
```

For local or controlled bootstrapping and data seeding:

```bash
npx prisma db push
pnpm prisma:seed
```

### Safe demo seed vs production safety guard

Use the dedicated demo seeding runner for local or controlled test data only:

```bash
pnpm run seed:demo
```

This script includes a production safety check. It refuses to run when `NODE_ENV=production` or when `DATABASE_URL` looks like a live merchant database, unless the explicit override is passed:

```bash
pnpm run seed:demo -- --force-seed-demo
```

Production usage should avoid this demo runner entirely. The default Prisma seed path stays separate and is intended only for explicit, controlled seeding workflows.

## Backend business flow highlights

### Retail operations

- Offline-first sync queue processing through `app/api/sync/route.ts`
- Sales processing with stock decrement, payment tracking, and audit logging
- Cash session open/close flows through `app/api/cash/session/route.ts`
- Inventory adjustment handling through `app/api/inventory/adjust/route.ts`
- Employee provisioning through `app/api/employees/route.ts`, including business-scoped role validation and hashed PIN storage
- Summary analytics through `app/api/reports/summary/route.ts`, including revenue, cost of goods, expenses, net profit, inventory valuation, and daily trends

### Supplier and purchase order workflow

The backend includes a supplier restock flow for purchasing inventory from distributors:

- `POST /api/purchase-orders` with `CREATE` and `RECEIVE` actions
- Restock requests create a purchase order and purchase items
- Receiving a delivery updates the purchase order status and increments the relevant inventory quantities

This is designed to support the small retailer workflow for stock replenishment and vendor tracking.

### M-Pesa payment flow

The payment integration is designed for resilient checkout confirmation:

- Each business has one encrypted M-Pesa integration record configured by a user with the `payments` permission.
- The server initiates Daraja requests and polls payment status using the transaction's authenticated business integration.
- The mobile terminal can support device-level payment confirmation workflows where the required Android permissions and services are available.
- Payment callbacks and status updates must remain tenant-scoped and idempotent.
- The server selects `sandbox` or `production` exclusively from `MPESA_ENVIRONMENT`; tenants cannot select an endpoint.
- Set `MPESA_CREDENTIALS_ENCRYPTION_KEY` to a base64-encoded 32-byte key generated with `openssl rand -base64 32`, then retain it for the lifetime of the encrypted records.
- Set `MPESA_CALLBACK_URL` to the public callback endpoint. Tenant Daraja credentials are entered in Payment Methods, encrypted at rest, and never returned by the API.

## Flutter app

The Flutter app in `flutter_app/` is maintained as a separate implementation for mobile-focused UI validation, APK builds, and iOS build pipelines. It is intentionally kept alongside the Next.js app rather than merged into the web app, so both codebases can evolve independently while preserving the same design references.

### Flutter app commands

```bash
cd flutter_app
flutter pub get
flutter run -d chrome
```

Or for Android release builds:

```bash
cd flutter_app
flutter build apk --release
```

### Mobile maintenance and synchronization

The mobile implementation maintains a local sync queue for supported offline work. After records are confirmed as synchronized, the cache optimizer can remove stale synchronized records and reclaim SQLite storage through maintenance operations. Do not uninstall the app or clear its data while unsynchronized transactions remain on the device.

## Coexistence model

This repository intentionally supports both platforms:

- Next.js handles the web product surface, API layer, and backend business logic
- Flutter handles native/mobile design parity and platform-specific packaging
- Capacitor files remain available for wrapping web builds as native Android/iOS apps when needed

## Deployment

The Vercel deployment workflow is defined in `.github/workflows/release.yml` and runs for pushes to `dev` and `main`. It installs the repository-pinned pnpm version, generates Prisma Client, installs the Vercel CLI, and deploys the production project.

Required GitHub Actions secrets and Vercel environment variables include:

| Variable | Purpose |
| --- | --- |
| `VERCEL_TOKEN` | Authenticates the deployment CLI. |
| `VERCEL_ORG_ID` | Identifies the Vercel organization or team. |
| `VERCEL_PROJECT_ID` | Identifies the Vercel project. |
| `DATABASE_URL` | Connects Prisma to the production PostgreSQL database. |
| `MPESA_CREDENTIALS_ENCRYPTION_KEY` | Base64-encoded 32-byte key used to encrypt each tenant's Daraja credentials. |
| `MPESA_ENVIRONMENT` | Server-only Daraja target: `sandbox` or `production`. |
| `MPESA_CALLBACK_URL` | Public HTTPS M-Pesa callback endpoint. |

The workflow currently uses Node 24 and the pnpm version declared in `package.json`. Keep these versions aligned when changing CI configuration.

## Notes

- The web app and Flutter app are meant to coexist in the same repository.
- UI parity work should continue by comparing the React/Next screen logic to the Flutter prototype as needed.
- The repository is structured to support rapid web iteration without losing the separate mobile build path.
- The API docs and schema are intended to remain synchronized with the current backend implementation.
