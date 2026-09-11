# MobiDuka POS

MobiDuka is a multi-platform commerce workspace containing a Next.js web application and a separate Flutter mobile prototype. The web app is the primary production-facing UI, while the Flutter app is a parallel native/mobile design and build target.

## Project overview

- `app/` – Next.js App Router shell and page entry point
- `app/components/` – POS, dashboard, inventory, customer, reporting, settings, and other UI screens
- `app/global.css` – shared styling and design tokens
- `flutter_app/` – Flutter implementation for mobile/native experimentation and APK/iOS build workflows
- `android/`, `ios/` – native platform projects used by Capacitor and mobile build tooling

## Web app (Next.js)

The Next.js app is the primary product shell for browser-based usage.

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

- Next.js handles the web product surface and future app-router UI work
- Flutter handles native/mobile design parity and platform-specific packaging
- Capacitor files remain available for wrapping web builds as native Android/iOS apps when needed

## Notes

- The web app and Flutter app are meant to coexist in the same repository.
- UI parity work should continue by comparing the React/Next screen logic to the Flutter prototype as needed.
- The repository is structured to support rapid web iteration without losing the separate mobile build path.
