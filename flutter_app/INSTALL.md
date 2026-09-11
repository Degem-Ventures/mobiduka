# MobiDuka Flutter Installation

This guide explains how to install Flutter and run the MobiDuka app on Linux or Windows.

## Project Requirements

- Flutter 3.19 or newer
- Dart 3.3 or newer
- Git
- Internet access for Flutter and pub packages

The app uses Flutter Material 3 and the `fl_chart` package. No backend or credentials are required.

## Linux

### 1. Install required packages

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y git curl unzip xz-utils zip libglu1-mesa clang cmake ninja-build pkg-config libgtk-3-dev
```

### 2. Install Flutter

Install Flutter with Git:

```bash
git clone https://github.com/flutter/flutter.git --branch stable --depth 1 "$HOME/flutter"
echo 'export PATH="$HOME/flutter/bin:$PATH"' >> "$HOME/.bashrc"
source "$HOME/.bashrc"
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

### 4. Install project dependencies

From the repository root:

```bash
cd flutter_app
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

Restart PowerShell and verify:

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

### `Address already in use`

Another process is using the selected port. Use another port:

```bash
flutter run -d web-server --web-port 8081
```

### `This application is not configured to build on the web`

Generate the web platform files once from `flutter_app`:

```bash
flutter create . --platforms web
```

### Android or iOS

Android requires Android Studio and the Android SDK. iOS development requires macOS and Xcode. Neither is required to run this project on Linux or Windows desktop/web.