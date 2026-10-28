plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.kmp)
}

kotlin {
    android {
        namespace = "com.omnishop.connectors"
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
        commonMain.dependencies {
            api(project(":core"))
            implementation(libs.ktor.http)
        }
        commonTest.dependencies { implementation(kotlin("test")) }
    }
}
