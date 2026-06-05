package com.flynnai.app.capture.notification

import java.util.concurrent.ConcurrentHashMap

/**
 * Rebuilds recent conversation context across notifications. A messaging notification typically
 * carries only the latest line (or a short bundle), so across a back-and-forth we accumulate the
 * distinct inbound messages per conversation. Keyed by the notification's stable conversation key
 * (shortcutId or sbn.key). In-memory only — losing it on process death is fine; we only ever need
 * the most recent context.
 */
class ConversationAccumulator(private val maxMessagesPerThread: Int = 10) {

    private data class Thread(
        val messages: MutableList<String> = mutableListOf(),
        val hashes: MutableSet<Int> = mutableSetOf(),
        var sender: String? = null,
        var updatedAt: Long = 0L,
    )

    private val threads = ConcurrentHashMap<String, Thread>()

    /**
     * Merge a freshly-extracted set of inbound messages into the thread and return the full
     * accumulated context (deduped, capped, oldest→newest) to draft against.
     */
    @Synchronized
    fun accumulate(
        key: String,
        inboundMessages: List<String>,
        sender: String?,
        now: Long,
    ): List<String> {
        val thread = threads.getOrPut(key) { Thread() }
        if (sender != null) thread.sender = sender
        thread.updatedAt = now
        for (m in inboundMessages) {
            val h = m.hashCode()
            if (thread.hashes.add(h)) {
                thread.messages.add(m)
                if (thread.messages.size > maxMessagesPerThread) {
                    val removed = thread.messages.removeAt(0)
                    thread.hashes.remove(removed.hashCode())
                }
            }
        }
        return thread.messages.toList()
    }

    @Synchronized
    fun senderFor(key: String): String? = threads[key]?.sender

    @Synchronized
    fun forget(key: String) {
        threads.remove(key)
    }

    @Synchronized
    fun clear() {
        threads.clear()
    }
}
