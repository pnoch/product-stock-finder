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
            implementation(libs.jmdns)
        }
        jvmTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.coroutines.core)
        }
    }
}

tasks.register<JavaExec>("runSyncHarness") {
    group = "verification"
    val testCompilation = kotlin.targets.getByName("jvm").compilations.getByName("test")
    classpath = files(testCompilation.output.allOutputs, testCompilation.runtimeDependencyFiles)
    mainClass.set("com.omnishop.sync.SyncHarnessKt")
}
