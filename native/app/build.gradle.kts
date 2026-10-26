plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.kmp)
    alias(libs.plugins.compose)
    alias(libs.plugins.compose.compiler)
}

kotlin {
    android {
        namespace = "com.omnishop.app"
        compileSdk = 37
        minSdk = 26
        androidResources.enable = true
        withHostTest {}
    }
    jvm()
    listOf(iosArm64(), iosSimulatorArm64()).forEach { target ->
        target.binaries.framework {
            baseName = "OmniShopShared"
            isStatic = true
        }
    }
    jvmToolchain(21)
    sourceSets {
        commonMain.dependencies {
            implementation(project(":core"))
            implementation(project(":data"))
            implementation(project(":connectors"))
            implementation(libs.compose.runtime)
            implementation(libs.compose.foundation)
            implementation(libs.compose.material3)
            implementation(libs.compose.ui)
            api(libs.compose.resources)
            implementation(libs.coroutines.core)
        }
        commonTest.dependencies { implementation(kotlin("test")) }
    }
}

compose.resources {
    packageOfResClass = "com.omnishop.app.resources"
    publicResClass = true
}
