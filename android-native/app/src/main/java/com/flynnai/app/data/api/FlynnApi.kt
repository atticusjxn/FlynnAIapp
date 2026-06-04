package com.flynnai.app.data.api

import com.flynnai.app.core.Environment
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

object FlynnApi {
    private val json = Json { ignoreUnknownKeys = true }

    private val http = HttpClient(Android) {
        install(ContentNegotiation) { json(json) }
        defaultRequest { contentType(ContentType.Application.Json) }
    }

    @Serializable
    private data class ProvisionTokenResponse(val token: String, val expiresAt: String? = null)

    @Serializable
    data class DraftRequest(val messages: List<String>)

    @Serializable
    data class DraftResponse(val drafts: List<String>)

    @Serializable
    data class AcceptDraftRequest(val text: String)

    sealed class ApiError : Exception() {
        data object NotConfigured : ApiError()
        data object LimitReached : ApiError()
        data class Server(val code: Int) : ApiError()
        data object Decode : ApiError()
    }

    suspend fun provisionKeyboardToken(accessToken: String): String {
        val response = http.post("${Environment.flynnApiBaseUrl}/api/keyboard/provision-token") {
            bearerAuth(accessToken)
            setBody("{}")
        }
        if (!response.status.value.let { it in 200..299 }) {
            throw ApiError.Server(response.status.value)
        }
        return json.decodeFromString<ProvisionTokenResponse>(response.bodyAsText()).token
    }

    suspend fun fetchDrafts(messages: List<String>, token: String): List<String> {
        val response = http.post("${Environment.flynnApiBaseUrl}/api/keyboard/draft-replies") {
            bearerAuth(token)
            setBody(DraftRequest(messages))
        }
        return when (response.status.value) {
            402 -> throw ApiError.LimitReached
            in 200..299 -> json.decodeFromString<DraftResponse>(response.bodyAsText()).drafts
            else -> throw ApiError.Server(response.status.value)
        }
    }

    fun recordAccepted(text: String, token: String) {
        @Suppress("OPT_IN_USAGE")
        GlobalScope.launch(Dispatchers.IO) {
            runCatching {
                http.post("${Environment.flynnApiBaseUrl}/api/keyboard/accept-draft") {
                    bearerAuth(token)
                    setBody(AcceptDraftRequest(text))
                }
            }
        }
    }
}
