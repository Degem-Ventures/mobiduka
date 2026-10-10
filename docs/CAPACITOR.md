# Build the Android APK

Capacitor packages a local Vite build of the same React screens used by Next.js. The native app shell therefore launches without network access; API calls use the configured deployed Next.js origin. After one successful online sign-in, the native app can cache the active business's employee PIN hashes and permit business-scoped PIN login offline for up to seven days. The cache contains hashes, not plaintext PINs; local login locks for five minutes after five incorrect attempts. An offline PIN session is restricted to POS and the signed-in employee's cached active shift; only cash sales can be queued. The SQLite database is app-private but is not encrypted by the current plugin, and four-digit PIN hashes are vulnerable to offline guessing if a device is rooted or its app files are extracted. Protect the device with its OS screen lock and use offline PIN login only on trusted devices. Offline PIN login uses a local-only session with no API token: saved business data can be viewed and cash sales can be queued, but queued sales do not sync until an online sign-in obtains a server session. Staff changes or PIN revocations cannot reach a disconnected device until its roster is refreshed, so reconnect and sign in online to revalidate access.

Signing in initially and loading the POS catalog and shift require internet access. On-device Sync has a **Download data for offline use** action that refreshes supported SQLite snapshots in one pass and shows per-dataset progress and failures; it also displays which snapshot groups are saved, their oldest save time, and an approximate JSON payload size for cached collections and queued sales. This excludes PIN-roster data and SQLite overhead, and is not a cloud quota or device-storage quota. Keep the app online and signed in until the download completes. It includes the POS and inventory catalogs, customer/credit lists and each customer's latest 20 sales and credit entries, dashboard and reports, receipts, suppliers, purchase orders, expenses, notifications, roles, settings snapshots, shifts, employee directory, profile, and offline PIN roster. Cached data remains a snapshot and can become stale. Inventory and POS identify saved catalog data and its save time while offline. Local cash sales update the saved stock counts without changing that time, which indicates the last server refresh, not the time of the local sale. Inventory can show the saved catalog offline, but product and category changes require an online session; cached inventory edit controls are not offered offline. Offline cash sales decrement stock in both cached POS and inventory catalogs. Older customer/credit transaction histories are not included. The cached catalog and active shift allow cash sales to be recorded in SQLite while offline and synchronized when connectivity returns and the app has an online session. POS receipt history keeps a recent server-history snapshot and includes local unsynchronized cash sales, labeled as pending or failed; older server receipts still require connectivity. SmartScan can resolve barcodes from the saved inventory catalog, falling back to the saved POS catalog if necessary; it labels snapshot results with their save time when available and does not record offline lookups in server scan activity. Cached products can be handed to POS, where the normal offline cash-sale queue applies. Restocking and creating products still require an online connection. On-device Sync lists the 50 most recent unsent cash sales with their pending/failed state and any saved failure reason, and can retry them after an online sign-in. Cloud backup, CSV export, and cache clearing are not implemented there. Payment account details and credentials are not cached. The offline employee directory omits phone numbers, email addresses, salaries, and PIN status. Receipt preview snapshots omit KRA PIN and business contact details; tax settings and settings overview snapshots omit the KRA PIN, and the settings overview also omits business contact details. Profile, PIN, customer, employee, receipt, tax, role, payment configuration, credit payment, expense, supplier, purchase-order, notification, inventory, and shift changes, as well as M-Pesa and credit sales, still require an online connection. The native Android project is in `android/` and uses the app ID `com.mobiduka.pos`.

The first upgrade from the previous remote-origin APK may require one online sign-in because WebView storage is isolated by origin and the locally bundled app uses a new origin.

Exception to the cash-sale-only queuing statements above: when offline in the Capacitor app, new cash expenses can also be saved to SQLite and queued for synchronization. They appear in the expense list as pending or failed; failed entries can be retried after an online sign-in. Editing or deleting an expense, and recording an M-Pesa or bank expense, still requires an online session.

## Local build

Install Android Studio or the Android command-line SDK first. Then run:

```bash
pnpm install
MOBIDUKA_API_ORIGIN=https://mobiduka.vercel.app pnpm run cap:sync
cd android
./gradlew assembleDebug
```

The debug APK is created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

The GitHub Actions workflow uses the runner's Gradle installation, so it does not depend on the Git LFS Gradle wrapper binary.

## GitHub Actions build

The workflow at `.github/workflows/build-capacitor-apk.yml` bundles the React UI locally and creates the APK on Ubuntu with Node 24, Java 21, Gradle, and the Android SDK supplied by the runner. Set the `MOBIDUKA_API_ORIGIN` repository variable to the deployed app origin when it differs from `https://mobiduka.vercel.app`.

1. Push this project to GitHub.
2. Open the repository's **Actions** tab.
3. Run **Build Capacitor Android APK (Locally Bundled UI)** with **Run workflow**.
4. Download the `mobiduka-capacitor-debug-apk-<run number>` artifact from the completed workflow.

The workflow also runs automatically for pushes to `dev`.

## Updating the app

After changing React code or native plugin dependencies, rebuild and sync the native project:

```bash
MOBIDUKA_API_ORIGIN=https://mobiduka.vercel.app pnpm run cap:sync
```

Then rerun the sync and Gradle build commands above, or rerun the GitHub workflow.

## iOS GitHub Actions build

The workflow at `.github/workflows/build-capacitor-ios.yml` runs on `macos-latest`, bundles the React UI locally, installs CocoaPods, and compiles an unsigned iOS Simulator app. It runs automatically for pushes to `dev` or can be started manually from the Actions tab.

Download the `mobiduka-ios-simulator` artifact from a successful run. It contains `App.app` packaged as a ZIP for simulator testing.

This artifact is not installable on a physical iPhone. A device IPA requires Apple Developer signing credentials, certificates, and provisioning profiles stored as GitHub Actions secrets. The current workflow intentionally avoids signing so it can build without Apple credentials.
