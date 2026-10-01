pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            file("local.properties").inputStream().use { properties.load(it) }
            val flutterSdkPath = properties.getProperty("flutter.sdk")
            require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
            flutterSdkPath
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "9.1.0" apply false
    id("com.google.gms.google-services") version "4.5.0" apply false
    id("org.jetbrains.kotlin.android") version "2.4.0" apply false
}

include(":app")

// Some Flutter plugins still pin compileSdk to Android 31-33 even though
// their AndroidX dependencies require a newer API. Align them before Gradle
// evaluates their library projects, matching the release CI build.
gradle.beforeProject {
    val source = buildFile.takeIf { it.isFile }?.readText() ?: return@beforeProject
    val updated = source
        .replace(
            Regex("compileSdkVersion\\s+(?:31|32|33)\\b"),
            "compileSdkVersion 36",
        )
        .replace(
            Regex("compileSdk\\s*=\\s*(?:31|32|33)\\b"),
            "compileSdk = 36",
        )
    if (updated != source) buildFile.writeText(updated)
}
