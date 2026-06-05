-keep class com.flynnai.app.** { *; }
-keepattributes *Annotation*

# kotlinx.serialization
-keepattributes EnclosingMethod,InnerClasses,Signature
-keep @kotlinx.serialization.Serializable class * { *; }
-keep class kotlinx.serialization.** { *; }
-keepclassmembers class ** {
    @kotlinx.serialization.Serializable *;
    *** Companion;
}

# Ktor
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**

# OkHttp
-dontwarn okhttp3.**
-keep class okhttp3.** { *; }

# Supabase-kt
-keep class io.github.jan.supabase.** { *; }
-dontwarn io.github.jan.supabase.**

# Kotlin coroutines
-keepnames class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

# Google Play Billing
-keep class com.android.billingclient.** { *; }
