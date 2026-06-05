package com.flynnai.app.capture.staging

import com.flynnai.app.data.api.FlynnApi
import kotlinx.serialization.Serializable

/**
 * A captured conversation staged by a background capture path (notification / screenshot)
 * for the Flynn keyboard to pick up on its next show. Mirrors the iOS `StagedScreenshotDraft`.
 *
 * Single-slot, most-recent-wins: a newer capture overwrites an older un-consumed one, because
 * the user is always acting on the latest message.
 */
@Serializable
data class StagedDraft(
    /** The customer's message(s) that drafts were generated from. */
    val messages: List<String>,
    /** Finished reply drafts. Empty when [needsDraft] is true. */
    val drafts: List<String>,
    /** One of [FlynnApi.Source]. */
    val source: String,
    /** Display name of the conversation/sender, shown as a header so the user confirms the thread. */
    val sender: String? = null,
    /** Epoch millis when captured — used for the freshness window in the keyboard. */
    val capturedAt: Long,
    /** Set once the keyboard has rendered this draft so it isn't replayed. */
    val consumed: Boolean = false,
    /** True when capture succeeded but drafting couldn't run (no token / network) — the
     *  keyboard should draft from [messages] on pickup. */
    val needsDraft: Boolean = false,
    /** True when the free-tier daily cap was hit — the keyboard shows the upgrade prompt. */
    val limitReached: Boolean = false,
) {
    val isFresh: Boolean
        get() = true // freshness window is evaluated by the consumer against capturedAt

    companion object {
        /** A capture that produced finished drafts. */
        fun ready(
            messages: List<String>,
            drafts: List<String>,
            source: String,
            sender: String?,
            capturedAt: Long,
        ) = StagedDraft(messages, drafts, source, sender, capturedAt)

        /** A capture whose drafting must be retried by the keyboard. */
        fun needsDraft(
            messages: List<String>,
            source: String,
            sender: String?,
            capturedAt: Long,
        ) = StagedDraft(messages, emptyList(), source, sender, capturedAt, needsDraft = true)

        /** A capture blocked by the free-tier limit. */
        fun limitReached(
            messages: List<String>,
            source: String,
            sender: String?,
            capturedAt: Long,
        ) = StagedDraft(messages, emptyList(), source, sender, capturedAt, limitReached = true)
    }
}
