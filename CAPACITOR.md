# Build the Android APK

The React/Vite app is packaged with Capacitor. The native Android project is in `android/` and uses the app ID `com.mobiduka.pos`.

## Local build

Install Android Studio or the Android command-line SDK first. Then run:

```bash
npm ci
npm run android:debug
```

The debug APK is created at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## GitHub Actions build

The workflow at `.github/workflows/build-capacitor-apk.yml` builds the APK on Ubuntu with Node, Java, and the Android SDK supplied by the runner.

1. Push this project to GitHub.
2. Open the repository's **Actions** tab.
3. Run **Build Capacitor Android APK** with **Run workflow**.
4. Download the `mobiduka-debug-apk` artifact from the completed workflow.

The workflow also runs automatically for pushes to `main` or `master`.

## Updating the app

After changing React code, rebuild and sync the native project:

```bash
npm run cap:sync
```

Then rebuild the APK with `npm run android:debug` or rerun the GitHub workflow.