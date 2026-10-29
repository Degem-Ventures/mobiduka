# Android ADB and Logcat guide (Windows PowerShell)

Use this guide to connect an Android phone to Windows, install Android Debug
Bridge (ADB), and capture MobiDuka logs for troubleshooting.

## 1. Install ADB

Open PowerShell and install Google's Android SDK Platform-Tools:

```powershell
winget install --id Google.PlatformTools --exact
```

Close PowerShell and open a new window so it reloads the updated `PATH`. Check
that ADB is available:

```powershell
adb version
```

If PowerShell still says that `adb` is not recognized, refresh `PATH` in the
current window and retry:

```powershell
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
adb version
```

Do not type the PowerShell prompt (for example, `PS C:\...>`) as part of a
command. Run these commands in Windows PowerShell, not a WSL terminal.

## 2. Connect and authorize the phone

1. On the phone, enable **Developer options**. Usually this is under
   **Settings > About phone**; tap **Build number** several times if prompted.
2. In **Developer options**, turn on **USB debugging**.
3. Connect the unlocked phone to the PC with a USB data cable. Choose **File
   transfer** from the phone's USB notification if shown.
4. In PowerShell, run:

   ```powershell
   adb devices -l
   ```

5. On the phone, accept the **Allow USB debugging?** prompt. Optionally select
   **Always allow from this computer**. Run `adb devices -l` again; the status
   should be `device`.

Status meanings:

- `device`: connected and authorized.
- `unauthorized`: unlock the phone and approve the prompt. If it does not
  appear, use **Developer options > Revoke USB debugging authorizations**,
  reconnect, and approve again.
- No device listed: try another data-capable cable or USB port and select
  **File transfer**. Windows may require the phone manufacturer's USB driver.

If the ADB server needs restarting:

```powershell
adb kill-server
adb start-server
adb devices -l
```

## 3. Verify and install a tagged release APK

Before installing a release APK to test a native fix, verify the tag contains
the expected Capacitor setting. Run this from the repository directory in
PowerShell, replacing `v1.0.5` if you are testing a different tag:

```powershell
git show v1.0.5:capacitor.config.ts | Select-String "androidIsEncryption"
```

For the SQLite encryption initialization fix, the output should include
`androidIsEncryption: false`. If it does not, the tag does not contain that
configuration.

Install the downloaded release APK over the existing app:

```powershell
adb install -r "$env:USERPROFILE\Downloads\app-release.apk"
```

Change the path if the APK was saved elsewhere. The release must be signed with
the same key as the installed app; `-r` updates in place and normally preserves
app data. If Android reports a signature conflict, stop. Do not uninstall or
clear app data if there may be offline records or sales waiting to sync.

## 4. Capture a fresh MobiDuka log

Make sure the installed app is the APK built from the commit you are testing.
An older installed APK will not include later native Android changes. Updating
the app in place is normally fine; avoid uninstalling or clearing app data
unless you have confirmed local offline records are safe.

Open **two PowerShell windows**.

In **Window 1**, clear old device logs and start a full capture:

```powershell
adb logcat -c
adb logcat -b all -v threadtime | Tee-Object -FilePath "$env:USERPROFILE\Desktop\mobiduka-full-logcat.txt"
```

Leave this command running. In **Window 2**, force-stop and relaunch the app:

```powershell
adb shell am force-stop com.mobiduka.pos
adb shell monkey -p com.mobiduka.pos 1
```

If `monkey` cannot launch the app, open MobiDuka from the phone manually. Then
repeat the action that causes the problem and wait for the error. Return to
Window 1 and press **Ctrl+C** to stop capture.

## 5. Extract relevant lines

In PowerShell, filter the saved capture with context around matching lines:

```powershell
Select-String -Path "$env:USERPROFILE\Desktop\mobiduka-full-logcat.txt" -Pattern "CapacitorSQLitePlugin|CapacitorSQLite|AndroidRuntime|FATAL EXCEPTION|Caused by|NoClassDefFound|ClassNotFound|EncryptedSharedPreferences|MasterKey|SQLite" -Context 3,8
```

Copy the output and share it with the issue. If there are no matches, confirm
the capture was started before force-stopping/reopening the app. A message such
as `CapacitorSQLitePlugin: null` by itself only shows that a SQLite call failed;
startup exceptions and their `Caused by` lines are needed to identify why.

## 6. Protect diagnostic data

Logcat can include device details, account data, URLs, and other private
information. Review the filtered output before sharing it. Remove access
tokens, passwords, private keys, phone numbers, and other personal data. Never
share `.env` files, Firebase service-account credentials, or signing keys.

Clearing Logcat with `adb logcat -c` clears diagnostic messages only; it does
not erase the app's local database or other app data.
