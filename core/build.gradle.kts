plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.serialization)
}

kotlin {
    // Web consumption: emit an ESM library + TypeScript type definitions (.d.mts).
    js(IR) {
        browser()
        binaries.library()
        generateTypeScriptDefinitions()
        useEsModules()
    }

    // JVM target exists only to run commonTest fast (no Android target yet — deferred).
    jvm()

    sourceSets {
        commonMain {
            dependencies {
                implementation(libs.kotlinx.serialization.json)
            }
        }
        commonTest {
            dependencies {
                implementation(libs.kotlin.test)
            }
        }
    }
}
