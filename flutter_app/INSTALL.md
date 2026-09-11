# MobiDuka Flutter Installation

This guide explains how to install Flutter and run the MobiDuka app on Linux or Windows.

## Project Requirements

- Flutter 3.19 or newer
- Dart 3.3 or newer
- Git
- Internet access for Flutter and pub packages

The app uses Flutter Material 3 and the `fl_chart` package. No backend or credentials are required.

## First-time setup checklist

Before running the app, make sure all of these are true:

- Flutter is installed and on your `PATH`
- You are in the project folder: `flutter_app`
- Web support is enabled if you want browser preview
- The selected debug port is free if using `web-server`

## One-click Linux fix

If you are on Ubuntu/Debian and want a single command that installs the required Linux packages, adds Flutter to your shell, enables web, and verifies the app can start, use:

```bash
export PATH="$HOME/flutter/bin:$PATH" && \
  sudo apt update && \
  sudo apt install -y ninja-build libgtk-3-dev mesa-utils git curl unzip xz-utils zip clang cmake pkg-config && \
  if ! grep -qxF 'export PATH="$HOME/flutter/bin:$PATH"' "$HOME/.bashrc"; then echo 'export PATH="$HOME/flutter/bin:$PATH"' >> "$HOME/.bashrc"; fi && \
  source "$HOME/.bashrc" && hash -r && \
  cd /workspaces/mobiduka/flutter_app && \
  flutter config --enable-web && \
  flutter pub get && \
  flutter doctor
```

This project was validated using:

```bash
export PATH="$HOME/flutter/bin:$PATH"
cd /workspaces/mobiduka/flutter_app
flutter pub get
flutter run -d web-server --web-port 8080
```

## Docker (recommended for clean setup)

Docker is the easiest way to run this project without installing Flutter locally.

### 1. Build the image

From the repository root:

```bash
docker build -t mobiduka-flutter ./flutter_app
```

### 2. Run the app with live reload

From the repository root, use the helper script so stale containers are removed and a free port is selected automatically:

```bash
cd /workspaces/mobiduka/flutter_app
chmod +x run-dev.sh
./run-dev.sh
```

The script starts the app on the next available host port, usually `8080` or the next free port in range. When the app is running, open the URL printed in the terminal.

Flutter runs in debug web-server mode. To trigger a hot reload while the app is running, press `r` in the terminal where the Flutter process is running. File changes in the mounted project folder will be detected automatically.

### 3. Rebuild after code changes

```bash
cd /workspaces/mobiduka/flutter_app
./run-dev.sh
```

If you prefer the raw Docker command, use a free port explicitly:

```bash
docker rm -f mobiduka-flutter-dev >/dev/null 2>&1 || true
docker run --rm -it --name mobiduka-flutter-dev -p 8081:8080 -v "$(pwd)/flutter_app:/app" -w /app mobiduka-flutter
```

### 4. Docker troubleshooting

If the image does not build, confirm Docker is installed and running:

```bash
docker --version
docker info
```

If a port is already in use:

```bash
docker run --rm -it -p 8081:8080 mobiduka-flutter
```

## Linux

### 1. Install required packages

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y git curl unzip xz-utils zip libglu1-mesa clang cmake ninja-build pkg-config libgtk-3-dev mesa-utils
```

This project has been validated on Ubuntu 24.04 with the packages above. These are the missing items reported by Flutter doctor:

- `ninja` is required for Linux development
- `libgtk-3-dev` is required for Linux desktop
- `mesa-utils` is recommended for `eglinfo` / graphics diagnostics

If you are missing the Android toolchain, install Android Studio later for Android builds. For web-only or Linux desktop use, the app can still run without Android SDK.

### 2. Install Flutter

Install Flutter with Git:

```bash
git clone https://github.com/flutter/flutter.git --branch stable --depth 1 "$HOME/flutter"
echo 'export PATH="$HOME/flutter/bin:$PATH"' >> "$HOME/.bashrc"
source "$HOME/.bashrc"
```

If `flutter` still says “command not found”, run this once in the current shell:

```bash
export PATH="$HOME/flutter/bin:$PATH"
source ~/.bashrc
hash -r
```

Verify the installation:

```bash
flutter --version
flutter doctor
```

### 3. Enable Linux desktop support

```bash
flutter config --enable-linux-desktop
```

If `flutter doctor` reports missing Linux packages, install the packages listed in its output and run it again.

For this environment, the relevant fixes are:

```bash
sudo apt update
sudo apt install -y ninja-build libgtk-3-dev mesa-utils
```

Then verify:

```bash
flutter doctor
```

### 4. Install project dependencies

From the repository root:

```bash
cd flutter_app
flutter pub get
```

If `flutter pub get` fails because web support is not configured, run:

```bash
flutter config --enable-web
flutter create . --platforms web
flutter pub get
```

### 5. Run the app

Linux desktop:

```bash
flutter run -d linux
```

Browser-independent web server preview:

```bash
flutter config --enable-web
flutter create . --platforms web
flutter run -d web-server --web-port 8080
```

Open the forwarded port `8080` in your browser. If the port is busy, choose another one, for example `8081`.

If you see `No supported devices found with name or id matching 'chrome'`, use the web-server target instead of Chrome:

```bash
flutter run -d web-server --web-port 8080
```

If you see `Address already in use`, stop the process using the port or change ports:

```bash
lsof -i :8080
flutter run -d web-server --web-port 8081
```

## Windows

### 1. Install Git

Install Git for Windows from:

https://git-scm.com/download/win

Restart PowerShell after installation.

### 2. Install Flutter

Download the stable Flutter SDK ZIP from:

https://docs.flutter.dev/get-started/install/windows

Extract it to a location without spaces or administrator restrictions, for example:

```text
C:\src\flutter
```

Add this directory to the user `Path` environment variable:

```text
C:\src\flutter\bin
```

If PowerShell still says `flutter` is not recognized, restart the terminal or use:

```powershell
$env:Path += ";C:\src\flutter\bin"
```

Verify the install:

```powershell
flutter --version
flutter doctor
```

### 3. Install Visual Studio

Install Visual Studio 2022 and select the **Desktop development with C++** workload. Ensure these components are included:

- MSVC C++ build tools
- Windows 10 or Windows 11 SDK
- CMake tools for Windows

Run `flutter doctor` again until the Windows desktop toolchain is available.

### 4. Install project dependencies

In PowerShell:

```powershell
cd path\to\mobiduka\flutter_app
flutter pub get
```

### 5. Run the app

Windows desktop:

```powershell
flutter run -d windows
```

For a browser preview, enable web support and create the web platform files once:

```powershell
flutter config --enable-web
flutter create . --platforms web
flutter run -d chrome
```

If Chrome is not installed or is not detected, use the web server target:

```powershell
flutter run -d web-server --web-port 8080
```

If a port is already in use, change the port:

```powershell
flutter run -d web-server --web-port 8081
```

## Useful Commands

List available devices:

```bash
flutter devices
```

Check the project:

```bash
flutter analyze
```

Format Dart code:

```bash
dart format lib
```

Clean and reinstall dependencies:

```bash
flutter clean
flutter pub get
```

## Troubleshooting

### `flutter: command not found`

Flutter is not on your `PATH`. Linux:

```bash
export PATH="$HOME/flutter/bin:$PATH"
source ~/.bashrc
hash -r
```

Windows PowerShell:

```powershell
$env:Path += ";C:\src\flutter\bin"
```

For Windows, add the path permanently through **System Properties > Environment Variables**.

### `No supported devices found with name or id matching 'chrome'`

Chrome is not installed or Flutter cannot find it. Use:

```bash
flutter run -d web-server --web-port 8080
```

If you want Chrome support on Linux, install Chromium/Google Chrome and make sure `CHROME_EXECUTABLE` or the browser is on your `PATH`:

```bash
sudo apt install -y chromium-browser
# or install Google Chrome manually
```

### Android SDK not found

Flutter doctor may report:

```text
Unable to locate Android SDK.
```

This does not block web or Linux desktop development. For Android support, install Android Studio and then accept the SDK setup prompt or configure the SDK path:

```bash
flutter config --android-sdk "$HOME/Android/Sdk"
```

If you are only targeting the web app, you can ignore this warning and keep using the web-server target.

### `Address already in use`

Another process is using the selected port. Use another port:

```bash
lsof -i :8080
flutter run -d web-server --web-port 8081
```

### `This application is not configured to build on the web`

Generate the web platform files once from `flutter_app`:

```bash
flutter config --enable-web
flutter create . --platforms web
flutter pub get
```

### `flutter create .` prompts or fails because the folder is not empty

This project already contains a generated Flutter app. Run the command from the project folder and confirm you want to add the missing platform files.

```bash
cd flutter_app
flutter create . --platforms web
```

### `flutter run` hangs or the app never starts

Verify the project folder and dependencies:

```bash
cd flutter_app
flutter doctor
flutter pub get
flutter analyze
```

### Android or iOS

Android requires Android Studio and the Android SDK. iOS development requires macOS and Xcode. Neither is required to run this project on Linux or Windows desktop/web.