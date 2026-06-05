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

    /** Where a capture originated. The backend currently buckets anything != "screenshot"
     *  as "clipboard"; "notification" is forwarded for future server-side framing and is
     *  safe today (it falls through to the clipboard prompt). */
    object Source {
        const val CLIPBOARD = "clipboard"
        const val SCREENSHOT = "screenshot"
        const val NOTIFICATION = "notification"
    }

    @Serializable
    data class DraftRequest(
        val messages: List<String>,
        val source: String = Source.CLIPBOARD,
        val draftCount: Int? = null,
        val proposedSlots: List<String>? = null,
    )

    @Serializable
    data class DraftResponse(val drafts: List<String>)

    @Serializable
    data class AcceptDraftRequest(
        val text: String,
        val source: String = Source.CLIPBOARD,
        val candidates: List<String>? = null,
        val pickedIndex: Int? = null,
        val messages: List<String>? = null,
    )

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

    suspend fun fetchDrafts(
        messages: List<String>,
        token: String,
        source: String = Source.CLIPBOARD,
        draftCount: Int? = null,
        proposedSlots: List<String>? = null,
    ): List<String> {
        val response = http.post("${Environment.flynnApiBaseUrl}/api/keyboard/draft-replies") {
            bearerAuth(token)
            setBody(DraftRequest(messages, source, draftCount, proposedSlots))
        }
        return when (response.status.value) {
            402 -> throw ApiError.LimitReached
            in 200..299 -> json.decodeFromString<DraftResponse>(response.bodyAsText()).drafts
            else -> throw ApiError.Server(response.status.value)
        }
    }

    /** Fire-and-forget learning signal. Sends the inserted text plus the full candidate set,
     *  picked index, source, and the originating messages for contrastive/substance learning. */
    fun recordAccepted(
        text: String,
        token: String,
        source: String = Source.CLIPBOARD,
        candidates: List<String>? = null,
        pickedIndex: Int? = null,
        messages: List<String>? = null,
    ) {
        @Suppress("OPT_IN_USAGE")
        GlobalScope.launch(Dispatchers.IO) {
            runCatching {
                http.post("${Environment.flynnApiBaseUrl}/api/keyboard/accept-draft") {
                    bearerAuth(token)
                    setBody(AcceptDraftRequest(text, source, candidates, pickedIndex, messages))
                }
            }
        }
    }
}
