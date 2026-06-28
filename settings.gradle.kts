pluginManagement {
    repositories {
        google()
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "noveditor"

include(":core")

// Include the Android app only where Android is set up (a local.properties with the SDK path).
// The web Pages CI has no local.properties, so it never configures :android and stays free of the
// Android SDK / AGP requirement — the JS-only core build is untouched.
if (File(settingsDir, "local.properties").exists()) {
    include(":android")
}
