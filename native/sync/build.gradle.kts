plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.android.kmp)
}

kotlin {
    android {
        namespace = "com.omnishop.sync"
        compileSdk = 37
        minSdk = 26
        withHostTest {}
    }
    jvm()
    jvmToolchain(21)
    sourceSets {
        val jvmSharedMain by creating { dependsOn(commonMain.get()) }
        jvmMain.get().dependsOn(jvmSharedMain)
        androidMain.get().dependsOn(jvmSharedMain)
        jvmSharedMain.dependencies {
            implementation(project(":core"))
            implementation(project(":data"))
            implementation(libs.coroutines.core)
            implementation(libs.serialization.json)
            implementation(libs.bouncycastle.prov)
            implementation(libs.bouncycastle.pkix)
        }
        jvmTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.coroutines.core)
        }
    }
}
