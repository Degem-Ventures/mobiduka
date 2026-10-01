# Build the Android APK

The server-backed Next.js app is loaded by Capacitor from its deployed HTTPS origin. The native Android project is in `android/` and uses the app ID `com.mobiduka.pos`.

## Local build

Install Android Studio or the Android command-line SDK first. Then run:

```bash
pnpm install
CAPACITOR_SERVER_URL=https://mobiduka.vercel.app pnpm exec cap sync android
cd android
./gradlew assembleDebug
```

The debug APK is created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

The GitHub Actions workflow uses the runner's Gradle installation, so it does not depend on the Git LFS Gradle wrapper binary.

## GitHub Actions build

The workflow at `.github/workflows/build-capacitor-apk.yml` configures Capacitor to load the deployed MobiDuka HTTPS app and creates the APK on Ubuntu with Node 24, Java 21, Gradle, and the Android SDK supplied by the runner. Set the `MOBIDUKA_API_ORIGIN` repository variable to the deployed app origin when it differs from `https://mobiduka.vercel.app`.

1. Push this project to GitHub.
2. Open the repository's **Actions** tab.
3. Run **Build Capacitor Android APK (Next.js UI)** with **Run workflow**.
4. Download the `mobiduka-capacitor-debug-apk-<run number>` artifact from the completed workflow.

The workflow also runs automatically for pushes to `dev`.

## Updating the app

After changing React code, rebuild and sync the native project with `CAPACITOR_SERVER_URL` set to the deployed app origin:

```bash
CAPACITOR_SERVER_URL=https://mobiduka.vercel.app pnpm exec cap sync android
```

Then rerun the sync and Gradle build commands above, or rerun the GitHub workflow.

## iOS GitHub Actions build

The workflow at `.github/workflows/build-capacitor-ios.yml` runs on `macos-latest`, builds the React app, installs CocoaPods, and compiles an unsigned iOS Simulator app. It runs automatically for pushes to `dev` or can be started manually from the Actions tab.

Download the `mobiduka-ios-simulator` artifact from a successful run. It contains `App.app` packaged as a ZIP for simulator testing.

This artifact is not installable on a physical iPhone. A device IPA requires Apple Developer signing credentials, certificates, and provisioning profiles stored as GitHub Actions secrets. The current workflow intentionally avoids signing so it can build without Apple credentials.
