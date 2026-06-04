package com.flynnai.app.data.api

import android.content.Context
import com.flynnai.app.FlynnApp
import com.flynnai.app.core.Environment
import com.flynnai.app.keyboard.KeyboardTokenStore
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus

// Mirrors iOS KeyboardBridge.sync() — call on app foreground + after sign-in.
object KeyboardBridge {

    suspend fun sync(context: Context, businessName: String? = null) {
        val client = FlynnApp.instance.supabase

        // Always write the API base URL so the IME can find the backend
        KeyboardTokenStore.setApiBase(context, Environment.flynnApiBaseUrl)
        if (!businessName.isNullOrBlank()) {
            KeyboardTokenStore.setBusinessName(context, businessName)
        }

        try {
            val status = client.auth.sessionStatus.value
            if (status !is SessionStatus.Authenticated) return
            val accessToken = client.auth.currentAccessTokenOrNull() ?: return
            val token = FlynnApi.provisionKeyboardToken(accessToken)
            KeyboardTokenStore.setToken(context, token)
        } catch (_: Exception) {
            // Best-effort — IME shows "open Flynn to finish setup" until this succeeds
        }
    }

    fun clear(context: Context) = KeyboardTokenStore.clear(context)
}
