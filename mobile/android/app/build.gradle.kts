import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val releaseKeyFile = rootProject.file("key.properties")
// One human-maintained version; Android's installation counter is derived automatically.
val versionParts = flutter.versionName.split('.').map { it.toInt() }
require(versionParts.size == 3 && versionParts[1] in 0..999 && versionParts[2] in 0..999)
val derivedVersionCode = versionParts[0].toLong() * 1_000_000 + versionParts[1] * 1_000 + versionParts[2]
require(derivedVersionCode in 1..2_100_000_000)
val releaseKey = Properties().apply {
    if (releaseKeyFile.exists()) releaseKeyFile.inputStream().use { load(it) }
}
if (gradle.startParameter.taskNames.any { it.contains("release", ignoreCase = true) }
    && !releaseKeyFile.exists()) {
    throw GradleException("Release signing requires mobile/android/key.properties. See mobile/README.md.")
}

android {
    namespace = "com.markai.markai_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        // flutter drive uninstalls its target at teardown. Keep fixture/test
        // runs separate so they cannot erase the user's app and login keys.
        val integrationTest = project.findProperty("target")?.toString()
            ?.replace('\\', '/')?.contains("integration_test/") == true
        applicationId = if (integrationTest) "com.markai.markai_mobile.qa" else "com.markai.markai_mobile"
        manifestPlaceholders["appLabel"] = if (integrationTest) "MarkAI 测试" else "MarkAI"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = derivedVersionCode.toInt()
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            if (releaseKeyFile.exists()) {
                storeFile = rootProject.file(releaseKey.getProperty("storeFile"))
                storePassword = releaseKey.getProperty("storePassword")
                keyAlias = releaseKey.getProperty("keyAlias")
                keyPassword = releaseKey.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
