import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    // AGP 9+ has built-in Kotlin support — do NOT apply org.jetbrains.kotlin.android here.
    alias(libs.plugins.android.application)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "dev.noveditor.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "dev.noveditor"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_17
    }
}

dependencies {
    // Shared Kotlin Multiplatform core (consumed via its JVM target — commonMain is pure Kotlin).
    implementation(project(":core"))

    // core declares kotlinx-serialization-json as `implementation` (non-transitive), so the
    // app needs its own runtime dep to (de)serialize the core @Serializable models in the repo.
    implementation(libs.kotlinx.serialization.json)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    // Pure-JVM unit test for AndroidNovelRepository (no Robolectric — it takes a java.io.File).
    testImplementation(libs.junit)
}
