# Build the Android APK

Capacitor packages a local Vite build of the same React screens used by Next.js. The native app shell therefore launches without network access; API calls use the configured deployed Next.js origin. Signing in and loading the initial POS catalog and shift require internet access. Later, the cached catalog and active shift allow cash sales to be recorded in SQLite while offline and synchronized when connectivity returns. M-Pesa and credit sales still require an online connection. The native Android project is in `android/` and uses the app ID `com.mobiduka.pos`.

The first upgrade from the previous remote-origin APK may require one online sign-in because WebView storage is isolated by origin and the locally bundled app uses a new origin.

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
