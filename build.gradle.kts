// Root build script: declare shared plugins without applying them here.
// Each module (e.g. :core) applies what it needs. Versions come from gradle/libs.versions.toml.
plugins {
    alias(libs.plugins.kotlin.multiplatform) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.compose.compiler) apply false
}
