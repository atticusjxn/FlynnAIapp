package com.flynnai.app.capture.notification

import android.app.Notification
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * Pure extraction of the customer's message(s) and the sender label from a messaging
 * notification. Kept free of `StatusBarNotification` / service plumbing so it is unit-testable.
 *
 * Strategy, in order of fidelity:
 *  1. MessagingStyle (`NotificationCompat.MessagingStyle`) — the rich path. Gives a recent-message
 *     bundle with per-message `Person`, so we can keep only INBOUND messages (drop the user's own)
 *     and read the conversation title / sender name.
 *  2. Plain extras fallback — `EXTRA_TITLE` (sender) + `EXTRA_TEXT`/`EXTRA_BIG_TEXT` (latest),
 *     plus `EXTRA_REMOTE_INPUT_HISTORY` (the user's prior typed replies — used as context only).
 *
 * We never read `notification.actions` / RemoteInput here — extraction is strictly read-only.
 */
object MessagingStyleExtractor {

    data class Extracted(
        /** Inbound (customer) messages, oldest→newest. */
        val inboundMessages: List<String>,
        /** Best display name for the conversation/sender, or null. */
        val sender: String?,
    ) {
        val isEmpty: Boolean get() = inboundMessages.isEmpty()
    }

    fun extract(notification: Notification): Extracted {
        extractFromMessagingStyle(notification)?.let { if (!it.isEmpty) return it }
        return extractFromExtras(notification)
    }

    private fun extractFromMessagingStyle(notification: Notification): Extracted? {
        val style = NotificationCompat.MessagingStyle
            .extractMessagingStyleFromNotification(notification) ?: return null

        // The device owner — used to distinguish the user's own messages from the customer's.
        val selfName = style.user.name?.toString()
        val selfKey = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            style.user.key
        } else null

        val inbound = style.messages
            .filter { msg ->
                val person = msg.person
                when {
                    // A message with no person is treated as inbound (apps vary).
                    person == null -> true
                    selfKey != null && person.key == selfKey -> false
                    selfName != null && person.name?.toString() == selfName -> false
                    else -> true
                }
            }
            .mapNotNull { it.text?.toString()?.trim()?.ifBlank { null } }

        val sender = style.conversationTitle?.toString()?.ifBlank { null }
            ?: style.messages.lastOrNull { it.person?.name != null }?.person?.name?.toString()

        return Extracted(inbound, sender)
    }

    private fun extractFromExtras(notification: Notification): Extracted {
        val extras = notification.extras ?: return Extracted(emptyList(), null)

        val sender = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.ifBlank { null }

        val latest = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))
            ?.toString()?.trim()?.ifBlank { null }

        // EXTRA_TEXT_LINES carries multiple bundled lines on InboxStyle / some messaging apps.
        val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
            ?.mapNotNull { it?.toString()?.trim()?.ifBlank { null } }
            ?: emptyList()

        val messages = when {
            lines.isNotEmpty() -> lines
            latest != null -> listOf(latest)
            else -> emptyList()
        }
        return Extracted(messages, sender)
    }
}
