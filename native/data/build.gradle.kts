plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.sqldelight)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.android.kmp)
}

kotlin {
    android {
        namespace = "com.omnishop.data"
        compileSdk = 37
        minSdk = 26
    }
    jvm()
    iosArm64()
    iosSimulatorArm64()
    iosX64()
    jvmToolchain(21)

    sourceSets {
        commonMain.dependencies {
            api(project(":core"))
            implementation(libs.sqldelight.runtime)
            implementation(libs.serialization.json)
        }
        commonTest.dependencies { implementation(kotlin("test")) }
        jvmMain.dependencies { implementation(libs.sqldelight.sqlite) }
        jvmTest.dependencies {
            implementation(libs.bouncycastle.prov)
            implementation(libs.bouncycastle.pkix)
            implementation(libs.coroutines.core)
        }
        iosMain.dependencies { implementation(libs.sqldelight.native) }
        androidMain.dependencies { implementation(libs.sqldelight.android) }
    }
}

sqldelight {
    databases {
        create("OmniShopDatabase") {
            packageName.set("com.omnishop.data.db")
            schemaOutputDirectory.set(file("src/commonMain/sqldelight/databases"))
            verifyMigrations.set(true)
        }
    }
}
