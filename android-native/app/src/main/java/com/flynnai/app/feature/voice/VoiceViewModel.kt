package com.flynnai.app.feature.voice

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flynnai.app.FlynnApp
import com.flynnai.app.data.api.FlynnApi
import com.flynnai.app.keyboard.KeyboardTokenStore
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
data class ToneSample(
    val id: String,
    val sample_text: String,
    val source: String,
)

sealed interface VoiceState { data object Loading : VoiceState; data object Loaded : VoiceState; data class Error(val msg: String) : VoiceState }
sealed interface PreviewState { data object Idle : PreviewState; data object Loading : PreviewState; data class Ready(val draft: String) : PreviewState; data object Failed : PreviewState }

class VoiceViewModel : ViewModel() {
    private val client = FlynnApp.instance.supabase

    private val _state = MutableStateFlow<VoiceState>(VoiceState.Loading)
    val state = _state.asStateFlow()

    val written = MutableStateFlow<List<ToneSample>>(emptyList())
    val learned = MutableStateFlow<List<ToneSample>>(emptyList())
    val preview = MutableStateFlow<PreviewState>(PreviewState.Idle)

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = VoiceState.Loading
            try {
                val uid = client.auth.currentSessionOrNull()?.user?.id?.toString() ?: return@launch
                val all: List<ToneSample> = client.postgrest.from("tone_samples")
                    .select { filter { eq("user_id", uid) }; order("created_at", Order.DESCENDING) }
                    .decodeList()
                written.value = all.filter { it.source == "written" }
                learned.value = all.filter { it.source == "accepted" }
                _state.value = VoiceState.Loaded
            } catch (e: Exception) {
                _state.value = VoiceState.Error(e.message ?: "Load failed")
            }
        }
    }

    fun addSample(text: String) {
        viewModelScope.launch {
            try {
                val uid = client.auth.currentSessionOrNull()?.user?.id?.toString() ?: return@launch
                @Serializable data class Insert(val user_id: String, val sample_text: String, val source: String)
                client.postgrest.from("tone_samples").insert(Insert(uid, text.trim(), "written"))
                load()
            } catch (_: Exception) {}
        }
    }

    fun deleteSample(id: String) {
        viewModelScope.launch {
            try {
                client.postgrest.from("tone_samples").delete { filter { eq("id", id) } }
                written.value = written.value.filter { it.id != id }
                learned.value = learned.value.filter { it.id != id }
            } catch (_: Exception) {}
        }
    }

    fun updateSample(id: String, newText: String) {
        viewModelScope.launch {
            try {
                @Serializable data class Patch(val sample_text: String)
                client.postgrest.from("tone_samples")
                    .update(Patch(newText.trim())) { filter { eq("id", id) } }
                load()
            } catch (_: Exception) {}
        }
    }

    fun runPreview() {
        viewModelScope.launch {
            preview.value = PreviewState.Loading
            try {
                val token = KeyboardTokenStore.getToken(FlynnApp.instance)
                val result = FlynnApi.fetchDrafts(
                    listOf("Hi, are you free this week and how much would it cost?"),
                    token ?: ""
                )
                preview.value = if (result.isNotEmpty()) PreviewState.Ready(result.first()) else PreviewState.Failed
            } catch (_: Exception) {
                preview.value = PreviewState.Failed
            }
        }
    }
}
