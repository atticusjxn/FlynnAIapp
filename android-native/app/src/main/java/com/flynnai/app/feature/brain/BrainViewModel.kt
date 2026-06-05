package com.flynnai.app.feature.brain

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flynnai.app.FlynnApp
import com.flynnai.app.core.Environment
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.UUID

data class BrainService(val id: String = UUID.randomUUID().toString(), var name: String, var priceRange: String)

class BrainViewModel : ViewModel() {
    private val client = FlynnApp.instance.supabase
    private val http = OkHttpClient()

    val businessType = MutableStateFlow("")
    val businessDescription = MutableStateFlow("")
    val services = MutableStateFlow<List<BrainService>>(emptyList())
    val pricingNotes = MutableStateFlow("")
    val serviceArea = MutableStateFlow("")
    val websiteURL = MutableStateFlow("")

    private val _saving = MutableStateFlow(false)
    val saving = _saving.asStateFlow()

    private val _rescanning = MutableStateFlow(false)
    val rescanning = _rescanning.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            try {
                val uid = client.auth.currentSessionOrNull()?.user?.id?.toString() ?: return@launch
                @Serializable data class Svc(val name: String, val price_range: String? = null)
                @Serializable data class Row(
                    val business_type: String? = null,
                    val ai_instructions: String? = null,
                    val services: List<Svc>? = null,
                    val pricing_notes: String? = null,
                    val service_area: String? = null,
                    val website_url: String? = null,
                )
                val row: Row = client.postgrest.from("business_profiles")
                    .select { filter { eq("user_id", uid) } }
                    .decodeSingle()
                businessType.value = row.business_type ?: ""
                businessDescription.value = row.ai_instructions ?: ""
                services.value = row.services?.map { BrainService(name = it.name, priceRange = it.price_range ?: "") } ?: emptyList()
                pricingNotes.value = row.pricing_notes ?: ""
                serviceArea.value = row.service_area ?: ""
                websiteURL.value = row.website_url ?: ""
            } catch (_: Exception) {}
        }
    }

    fun save(onDone: () -> Unit) {
        viewModelScope.launch {
            _saving.value = true
            try {
                val token = client.auth.currentAccessTokenOrNull() ?: return@launch
                @Serializable data class Svc(val name: String, val price_range: String)
                @Serializable data class Patch(
                    val business_type: String,
                    val ai_instructions: String,
                    val services: List<Svc>,
                    val pricing_notes: String,
                    val service_area: String,
                    val website_url: String?,
                )
                val payload = Patch(
                    business_type = businessType.value,
                    ai_instructions = businessDescription.value,
                    services = services.value.map { Svc(it.name, it.priceRange) },
                    pricing_notes = pricingNotes.value,
                    service_area = serviceArea.value,
                    website_url = websiteURL.value.ifBlank { null },
                )
                val json = kotlinx.serialization.json.Json
                val body = json.encodeToString(Patch.serializer(), payload)
                val req = Request.Builder()
                    .url("${Environment.flynnApiBaseUrl}/api/business-profile")
                    .patch(body.toRequestBody("application/json".toMediaType()))
                    .addHeader("Authorization", "Bearer $token")
                    .build()
                http.newCall(req).execute()
                onDone()
            } catch (_: Exception) {}
            _saving.value = false
        }
    }

    fun rescan() {
        viewModelScope.launch {
            if (websiteURL.value.isBlank()) return@launch
            _rescanning.value = true
            try {
                val token = client.auth.currentAccessTokenOrNull() ?: return@launch
                @Serializable data class Req(val url: String)
                val json = kotlinx.serialization.json.Json
                val body = json.encodeToString(Req.serializer(), Req(websiteURL.value))
                val req = Request.Builder()
                    .url("${Environment.flynnApiBaseUrl}/api/scrape-website")
                    .post(body.toRequestBody("application/json".toMediaType()))
                    .addHeader("Authorization", "Bearer $token")
                    .build()
                http.newCall(req).execute()
                load()
            } catch (_: Exception) {}
            _rescanning.value = false
        }
    }
}
