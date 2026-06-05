package com.flynnai.app.capture.staging

import android.content.Context
import android.util.Log
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Cross-component handoff for captured drafts. The notification listener and the screen-capture
 * service WRITE here; the Flynn keyboard READS here on each show. Single-slot, most-recent-wins.
 *
 * Storage is a plain atomic JSON file in app-private `filesDir` (NOT world-readable), guarded by
 * an in-process [Mutex] and written via temp-file + atomic rename. We deliberately do NOT use
 * `EncryptedSharedPreferences` here: it is not multi-process safe and its keyset is fragile under
 * concurrent writes even in one process. Content is transient (already sent to the backend) so
 * app-private file storage is the right trade.
 *
 * ⚠️ Safe only because the whole app — listener, capture service, and IME — runs in a SINGLE
 * process (no `android:process` anywhere). If the IME is ever moved to its own process, migrate
 * this to a ContentProvider.
 */
object CaptureStagingStore {
    private const val TAG = "CaptureStaging"
    private const val FILE_NAME = "flynn_staged_draft.json"
    private val mutex = Mutex()
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private fun file(context: Context) = File(context.filesDir, FILE_NAME)

    /** Stage a capture, overwriting any previous one (most-recent-wins). */
    fun stage(context: Context, draft: StagedDraft) = runBlocking {
        mutex.withLock {
            runCatching {
                val tmp = File(context.filesDir, "$FILE_NAME.tmp")
                tmp.writeText(json.encodeToString(StagedDraft.serializer(), draft))
                if (!tmp.renameTo(file(context))) {
                    // renameTo can fail across some filesystems; fall back to copy.
                    file(context).writeText(tmp.readText())
                    tmp.delete()
                }
            }.onFailure { Log.w(TAG, "stage failed", it) }
            Unit
        }
    }

    /** Read the staged draft without consuming it. Returns null if none/unreadable. */
    fun peek(context: Context): StagedDraft? = runBlocking {
        mutex.withLock {
            val f = file(context)
            if (!f.exists()) return@withLock null
            runCatching { json.decodeFromString(StagedDraft.serializer(), f.readText()) }
                .onFailure { Log.w(TAG, "peek failed", it) }
                .getOrNull()
        }
    }

    /** Mark the staged draft consumed so it isn't replayed on the next keyboard show. */
    fun markConsumed(context: Context) = runBlocking {
        mutex.withLock {
            val f = file(context)
            if (!f.exists()) return@withLock
            runCatching {
                val current = json.decodeFromString(StagedDraft.serializer(), f.readText())
                if (!current.consumed) {
                    f.writeText(json.encodeToString(StagedDraft.serializer(), current.copy(consumed = true)))
                }
            }.onFailure { Log.w(TAG, "markConsumed failed", it) }
            Unit
        }
    }

    /** Remove any staged draft entirely. */
    fun clear(context: Context) = runBlocking {
        mutex.withLock { runCatching { file(context).delete() }; Unit }
    }
}
