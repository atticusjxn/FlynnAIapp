package com.flynnai.app.keyboard

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

// Mirrors iOS SharedSecureStore + SharedStore (no App Group needed — same APK/UID)
object KeyboardTokenStore {
    private const val PREF_FILE = "flynn_keyboard_secure"
    private const val KEY_TOKEN = "keyboard_token"
    private const val KEY_API_BASE = "api_base_url"
    private const val KEY_BUSINESS_NAME = "business_name"

    private fun prefs(context: Context) = EncryptedSharedPreferences.create(
        context,
        PREF_FILE,
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun setToken(context: Context, token: String) =
        prefs(context).edit().putString(KEY_TOKEN, token).apply()

    fun getToken(context: Context): String? = prefs(context).getString(KEY_TOKEN, null)

    fun setApiBase(context: Context, url: String) =
        prefs(context).edit().putString(KEY_API_BASE, url).apply()

    fun getApiBase(context: Context): String? = prefs(context).getString(KEY_API_BASE, null)

    fun setBusinessName(context: Context, name: String) =
        prefs(context).edit().putString(KEY_BUSINESS_NAME, name).apply()

    fun getBusinessName(context: Context): String? = prefs(context).getString(KEY_BUSINESS_NAME, null)

    fun clear(context: Context) = prefs(context).edit().clear().apply()
}
