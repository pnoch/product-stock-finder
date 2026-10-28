plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.kmp)
}

kotlin {
    android {
        namespace = "com.omnishop.core"
        compileSdk = 37
        minSdk = 26
        withHostTest {}
    }
    jvm()
    iosArm64()
    iosSimulatorArm64()
    iosX64()
    jvmToolchain(21)

    sourceSets {
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}
