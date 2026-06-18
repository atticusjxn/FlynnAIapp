plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.flynnai.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.flynnai.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 58
        versionName = "2.1.0"
    }

    signingConfigs {
        create("release") {
            // The registered Play upload key (SHA1 1D:59:B3:…:EF:4D), shared with the legacy
            // android/ project. The stray flynn-release.jks was never registered with Play.
            storeFile = file("../../android/app/flynn-upload.keystore")
            storePassword = "90a29bfc69139182b37d99e8c746f258"
            keyAlias = "34a3ad6d621a991a54e848b424e93815"
            keyPassword = "edca4d288925a225cd91eb83de21c25c"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
        }
    }
}

val supabaseVersion = "3.1.4"
val ktorVersion = "3.0.3"

dependencies {
    // Compose BOM
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.12.01"))

    // Core Compose
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // AndroidX
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-service:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.4")
    // IME Compose lifecycle integration
    implementation("androidx.savedstate:savedstate-ktx:1.2.1")

    // Security (EncryptedSharedPreferences)
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Supabase-kt
    implementation(platform("io.github.jan-tennert.supabase:bom:$supabaseVersion"))
    implementation("io.github.jan-tennert.supabase:auth-kt")
    implementation("io.github.jan-tennert.supabase:postgrest-kt")
    implementation("io.github.jan-tennert.supabase:storage-kt")

    // Ktor (HTTP engine for Supabase + custom API)
    implementation("io.ktor:ktor-client-android:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")

    // OkHttp (plain REST calls from ViewModel — onboarding, etc.)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Kotlinx serialization + coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Google Play Billing
    implementation("com.android.billingclient:billing-ktx:7.1.1")

    // Coil (image loading — mascot PNGs)
    implementation("io.coil-kt.coil3:coil-compose:3.0.4")

    // ML Kit on-device OCR (GMS-delivered model → lean APK, downloaded once via Play Services)
    implementation("com.google.android.gms:play-services-mlkit-text-recognition:19.0.1")

    // AndroidX core for NotificationCompat.MessagingStyle extraction (already transitively present
    // via compose, declared explicitly for the capture layer).
    implementation("androidx.core:core:1.15.0")

    // Unit tests
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("org.robolectric:robolectric:4.13")
    testImplementation("androidx.test:core:1.6.1")
}
