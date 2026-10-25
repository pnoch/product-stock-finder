plugins {
    alias(libs.plugins.kotlin.multiplatform) apply false
    alias(libs.plugins.sqldelight) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.compose) apply false
    alias(libs.plugins.compose.compiler) apply false
    alias(libs.plugins.android.kmp) apply false
    alias(libs.plugins.android.application) apply false
}

allprojects {
    group = "com.omnishop"
    version = "0.1.0"
}
