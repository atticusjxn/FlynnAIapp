package com.flynnai.app.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flynnai.app.FlynnApp
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

sealed interface HomeState { data object Loading : HomeState; data object Loaded : HomeState; data class Error(val msg: String) : HomeState }

class HomeViewModel : ViewModel() {
    private val client = FlynnApp.instance.supabase

    private val _state = MutableStateFlow<HomeState>(HomeState.Loading)
    val state = _state.asStateFlow()

    val firstName = MutableStateFlow<String?>(null)
    val keyboardAdded = MutableStateFlow(false)
    val calendarConnected = MutableStateFlow(false)
    val recentReplies = MutableStateFlow<List<String>>(emptyList())

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = HomeState.Loading
            try {
                val session = client.auth.currentSessionOrNull() ?: return@launch
                val uid = session.user?.id?.toString() ?: return@launch

                @Serializable data class ProfileRow(val full_name: String? = null, val calendar_sync_enabled: Boolean? = null)
                val profile: ProfileRow = client.postgrest.from("users")
                    .select { filter { eq("id", uid) } }.decodeSingle()
                firstName.value = profile.full_name?.split(" ")?.firstOrNull()
                calendarConnected.value = profile.calendar_sync_enabled == true

                @Serializable data class ReplyRow(val sample_text: String)
                val replies: List<ReplyRow> = client.postgrest.from("tone_samples")
                    .select {
                        filter { eq("user_id", uid); eq("source", "accepted") }
                        order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                        limit(5)
                    }
                    .decodeList()
                recentReplies.value = replies.map { it.sample_text }

                // Keyboard heartbeat: check SharedPreferences (same app UID as IME)
                keyboardAdded.value = android.preference.PreferenceManager
                    .getDefaultSharedPreferences(FlynnApp.instance)
                    .getBoolean("flynn.keyboardAcknowledged", false)
                    || com.flynnai.app.keyboard.KeyboardTokenStore.getToken(FlynnApp.instance) != null

                _state.value = HomeState.Loaded
            } catch (e: Exception) {
                _state.value = HomeState.Error(e.message ?: "Load failed")
            }
        }
    }
}
