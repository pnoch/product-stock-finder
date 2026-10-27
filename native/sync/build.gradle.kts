plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

kotlin { jvmToolchain(21) }

dependencies {
    implementation(project(":core"))
    implementation(project(":data"))
    implementation(libs.coroutines.core)
    implementation(libs.serialization.json)
    implementation(libs.bouncycastle.prov)
    implementation(libs.bouncycastle.pkix)
    testImplementation(kotlin("test"))
    testImplementation(libs.coroutines.core)
}
