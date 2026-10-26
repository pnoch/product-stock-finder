import org.jetbrains.compose.desktop.application.dsl.TargetFormat

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.compose)
    alias(libs.plugins.compose.compiler)
}

kotlin { jvmToolchain(21) }

dependencies {
    implementation(project(":app"))
    implementation(project(":data"))
    implementation(project(":connectors"))
    implementation(compose.desktop.currentOs)
    implementation(libs.coroutines.swing)
    implementation(libs.java.keyring)
}

compose.desktop {
    application {
        mainClass = "com.omnishop.desktop.MainKt"
        nativeDistributions {
            modules("java.sql")
            targetFormats(TargetFormat.Dmg, TargetFormat.Msi, TargetFormat.Deb)
            packageName = "OmniShop"
            packageVersion = "1.0.0"
            macOS {
                bundleID = "com.omnishop.desktop"
            }
        }
    }
}
