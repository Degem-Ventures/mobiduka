# Android signed APK releases

The Capacitor Android workflow builds a signed release APK and attaches it to a
GitHub Release. To upgrade an installed app, every APK must keep the same
application ID (`com.mobiduka.pos`), use the same release signing key, and have
a higher Android `versionCode`. The workflow sets `versionName` from the release
tag and uses its increasing GitHub Actions run number for `versionCode`.

## Create and protect the release key

Create the key once on a trusted computer with the JDK `keytool`. Keep the
keystore and passwords in secure, backed-up storage; do not regenerate this key
for later releases.

```sh
keytool -genkeypair -v \
  -keystore android/mobiduka-release.jks \
  -alias mobiduka-release \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

Record the keystore password, key password, and alias securely. The keystore and
`android/keystore.properties` are ignored by Git.

In the repository’s **Settings → Secrets and variables → Actions**, add these
repository secrets:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded contents of `android/mobiduka-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | `mobiduka-release` |
| `ANDROID_KEY_PASSWORD` | Password for the key |

On Linux, create a one-line base64 file for `ANDROID_KEYSTORE_BASE64` with:

```sh
base64 -w 0 android/mobiduka-release.jks > mobiduka-release.jks.base64
```

On macOS:

```sh
base64 -i android/mobiduka-release.jks | tr -d '\n' > mobiduka-release.jks.base64
```

Paste the file contents into the secret, then securely remove that temporary
base64 file. Never commit or share the keystore, base64 value, or passwords.
Loss of the signing key prevents Android from accepting future APK upgrades
over installs signed with that key.

For local release builds, `.env.local` can provide these values directly; set
`ANDROID_KEYSTORE_PATH` to a path relative to `android/` (the generated local
key is `mobiduka-release.jks`). Alternatively, create
`android/keystore.properties` with:

```properties
storeFile=mobiduka-release.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=mobiduka-release
keyPassword=YOUR_KEY_PASSWORD
```

Keep either credential file private. A local signed release can then be built
with:

```sh
gradle -p android assembleRelease \
  -PmobidukaVersionCode=2 \
  -PmobidukaVersionName=1.0.1
```

## Publish a release

Push a semantic-version tag to build and publish the signed APK:

```sh
git tag v1.0.1
git push origin v1.0.1
```

Alternatively, run **Build and publish signed Capacitor Android APK** from the
Actions tab and provide a version such as `1.0.1`. The workflow validates that
all signing secrets are configured, builds `assembleRelease`, verifies the APK
signature, and publishes the APK and build metadata on the GitHub Release.

Download the APK from the repository’s Releases page to update the app. Android
may ask the user to allow installation from the browser or file manager, then
requires confirmation to install the update; sideloaded APKs cannot silently
replace an installed app.

## Moving from the existing debug APK

The current Actions artifact is debug-signed. Android will not install a
release-signed APK as an update over an app signed with a different debug key.
Before the first release install, sync pending sales and preserve any other
needed on-device data, then uninstall the debug app and install the release APK.
Uninstalling clears its local app data. After that transition, future releases
signed with the persistent release key and a higher `versionCode` can update
the installed app without uninstalling it.
