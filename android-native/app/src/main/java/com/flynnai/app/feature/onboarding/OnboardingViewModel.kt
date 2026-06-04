package com.flynnai.app.feature.onboarding

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flynnai.app.FlynnApp
import com.flynnai.app.core.Environment
import com.flynnai.app.data.api.KeyboardBridge
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.UUID

enum class OnboardingStep {
    Welcome, WhatYouDo, ConfirmBrain, CaptureVoice,
    SoundsLikeYou, ConnectCalendar, Paywall, Practice, InstallKeyboard
}

data class DetectedService(val id: String = UUID.randomUUID().toString(), var name: String, var priceRange: String)

sealed interface LoadState { data object Idle : LoadState; data object Loading : LoadState; data object Loaded : LoadState; data class Error(val msg: String) : LoadState }

class OnboardingViewModel : ViewModel() {

    private val client = FlynnApp.instance.supabase
    private val http = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }

    private val _step = MutableStateFlow(OnboardingStep.Welcome)
    val step = _step.asStateFlow()

    private val _advancing = MutableStateFlow(true)
    val advancing = _advancing.asStateFlow()

    var businessDescription = MutableStateFlow("")
    var websiteURL = MutableStateFlow("")
    var detectedBusinessType = MutableStateFlow("")
    var detectedServices = MutableStateFlow<List<DetectedService>>(emptyList())
    var detectedPricingNote = MutableStateFlow("")
    var samplePrompts = MutableStateFlow<List<String>>(emptyList())

    private val _understandingState = MutableStateFlow<LoadState>(LoadState.Idle)
    val understandingState = _understandingState.asStateFlow()

    fun advance() {
        _advancing.value = true
        val next = OnboardingStep.entries.getOrNull(_step.value.ordinal + 1) ?: return
        _step.value = next
    }

    fun back() {
        _advancing.value = false
        val prev = OnboardingStep.entries.getOrNull(_step.value.ordinal - 1) ?: return
        _step.value = prev
    }

    fun skipTo(step: OnboardingStep) {
        _advancing.value = step.ordinal > _step.value.ordinal
        _step.value = step
    }

    fun understandBusiness() {
        val desc = businessDescription.value.trim()
        if (desc.isEmpty()) return
        viewModelScope.launch {
            _understandingState.value = LoadState.Loading
            try {
                val token = client.auth.currentAccessTokenOrNull() ?: throw Exception("Not signed in")
                @Serializable data class Req(val description: String)
                @Serializable data class Svc(val name: String, val price_range: String? = null)
                @Serializable data class Resp(
                    val businessType: String? = null,
                    val services: List<Svc> = emptyList(),
                    val pricingNote: String? = null,
                    val samplePrompts: List<String> = emptyList(),
                )
                val body = json.encodeToString(Req.serializer(), Req(desc))
                val req = Request.Builder()
                    .url("${Environment.flynnApiBaseUrl}/api/onboarding/understand")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .addHeader("Authorization", "Bearer $token")
                    .build()
                val resp = http.newCall(req).execute()
                if (!resp.isSuccessful) { _understandingState.value = LoadState.Error("Couldn't analyse your business"); return@launch }
                val decoded = json.decodeFromString(Resp.serializer(), resp.body!!.string())
                detectedBusinessType.value = decoded.businessType ?: ""
                detectedServices.value = decoded.services.map { DetectedService(name = it.name, priceRange = it.price_range ?: "") }
                detectedPricingNote.value = decoded.pricingNote ?: ""
                samplePrompts.value = decoded.samplePrompts
                _understandingState.value = LoadState.Loaded
            } catch (e: Exception) {
                _understandingState.value = LoadState.Error(e.message ?: "Something went wrong")
            }
        }
    }

    fun saveBusinessBrain() {
        viewModelScope.launch {
            try {
                val token = client.auth.currentAccessTokenOrNull() ?: return@launch
                @Serializable data class Svc(val name: String, val price_range: String)
                @Serializable data class Patch(
                    val business_type: String,
                    val services: List<Svc>,
                    val pricing_notes: String,
                    val ai_instructions: String,
                    val website_url: String? = null,
                )
                val payload = Patch(
                    business_type = detectedBusinessType.value,
                    services = detectedServices.value.map { Svc(it.name, it.priceRange) },
                    pricing_notes = detectedPricingNote.value,
                    ai_instructions = businessDescription.value,
                    website_url = websiteURL.value.ifBlank { null },
                )
                val body = json.encodeToString(Patch.serializer(), payload)
                val req = Request.Builder()
                    .url("${Environment.flynnApiBaseUrl}/api/business-profile")
                    .patch(body.toRequestBody("application/json".toMediaType()))
                    .addHeader("Authorization", "Bearer $token")
                    .build()
                http.newCall(req).execute()
            } catch (_: Exception) {}
        }
    }

    fun saveToneSamples(replies: List<String>) {
        viewModelScope.launch {
            try {
                val session = client.auth.currentSessionOrNull() ?: return@launch
                @Serializable data class Row(val user_id: String, val sample_text: String, val source: String)
                val uid = session.user?.id?.toString() ?: return@launch
                val rows = replies.filter { it.isNotBlank() }.map { Row(uid, it, "onboarding") }
                if (rows.isEmpty()) return@launch
                client.postgrest.from("tone_samples").insert(rows)
            } catch (_: Exception) {}
        }
    }

    fun markOnboardingComplete(context: Context) {
        viewModelScope.launch {
            // Provision keyboard token so IME is ready immediately
            KeyboardBridge.sync(context, detectedBusinessType.value.ifBlank { null })
            try {
                val session = client.auth.currentSessionOrNull() ?: return@launch
                val uid = session.user?.id?.toString() ?: return@launch
                @Serializable data class Patch(val onboarding_completed: Boolean)
                client.postgrest.from("users")
                    .update(Patch(true)) { filter { eq("id", uid) } }
            } catch (_: Exception) {}
        }
    }
}
