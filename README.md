# MobiDuka POS

MobiDuka is a multi-platform commerce workspace containing a Next.js web application and a separate Flutter mobile prototype. The web app is the primary product surface, while the Flutter app is a parallel native/mobile design and build target for Android and iOS workflows.

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
- sync
- sales
- cash/session
- purchase-orders

The Swagger UI assets are bundled locally under `public/swagger-ui/` so the docs render reliably without CDN dependency issues.

## Prisma and database sync

The project uses Prisma with SQLite for local development. The canonical schema lives in `prisma/schema.prisma`.

### Common commands

```bash
npx prisma generate
npx prisma db push
npx prisma validate
```

For local bootstrapping and data seeding:

```bash
npx prisma db push
pnpm prisma:seed
```

## Backend business flow highlights

### Retail operations

- Offline-first sync queue processing through `app/api/sync/route.ts`
- Sales processing with stock decrement, payment tracking, and audit logging
- Cash session open/close flows through `app/api/cash/session/route.ts`
- Inventory adjustment handling through `app/api/inventory/adjust/route.ts`

### Supplier and purchase order workflow

The backend includes a supplier restock flow for purchasing inventory from distributors:

- `POST /api/purchase-orders` with `CREATE` and `RECEIVE` actions
- Restock requests create a purchase order and purchase items
- Receiving a delivery updates the purchase order status and increments the relevant inventory quantities

This is designed to support the small retailer workflow for stock replenishment and vendor tracking.

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

## Coexistence model

This repository intentionally supports both platforms:

- Next.js handles the web product surface, API layer, and backend business logic
- Flutter handles native/mobile design parity and platform-specific packaging
- Capacitor files remain available for wrapping web builds as native Android/iOS apps when needed

## Notes

- The web app and Flutter app are meant to coexist in the same repository.
- UI parity work should continue by comparing the React/Next screen logic to the Flutter prototype as needed.
- The repository is structured to support rapid web iteration without losing the separate mobile build path.
- The API docs and schema are intended to remain synchronized with the current backend implementation.
