package com.flynnai.app.capture.notification

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.flynnai.app.BuildConfig
import com.flynnai.app.capture.CaptureSettings
import com.flynnai.app.capture.staging.CaptureStagingStore
import com.flynnai.app.capture.staging.StagedDraft
import com.flynnai.app.data.api.FlynnApi
import com.flynnai.app.keyboard.KeyboardTokenStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

/**
 * PRIMARY capture path. READ-ONLY: reads inbound message notifications from user-allowed apps,
 * drafts a reply in the background via the shared backend, and stages it for the Flynn keyboard.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *  ⚠️ ASSISTIVE-ONLY GUARANTEE — this class NEVER sends anything.
 *  It must never read `sbn.notification.actions`, never construct a `RemoteInput`, and never
 *  call `PendingIntent.send`. Firing another app's RemoteInput reply action SENDS the message,
 *  which violates Flynn's "never autonomous" principle. Drafts are only ever staged for the
 *  keyboard, where the user taps to insert. A unit test asserts this file contains no such calls.
 * ───────────────────────────────────────────────────────────────────────────────────────────
 */
class FlynnNotificationListener : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val accumulator = ConversationAccumulator()
    private val pendingDrafts = ConcurrentHashMap<String, Job>()

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        runCatching { handlePosted(sbn) }
            .onFailure { Log.w(TAG, "onNotificationPosted failed", it) }
    }

    private fun handlePosted(sbn: StatusBarNotification) {
        val pkg = sbn.packageName ?: return

        // 1. Self-exclusion + strict allowlist gate (the privacy contract).
        if (pkg == BuildConfig.APPLICATION_ID) return
        if (!CaptureSettings.isAllowed(this, pkg)) return

        val notification = sbn.notification ?: return

        // 2. Drop non-conversational / structural notifications.
        if (notification.category == Notification.CATEGORY_CALL) return
        val flags = notification.flags
        if (flags and Notification.FLAG_GROUP_SUMMARY != 0) return
        if (flags and Notification.FLAG_ONGOING_EVENT != 0) return

        // 3. Extract inbound (customer) messages + sender.
        val extracted = MessagingStyleExtractor.extract(notification)
        if (extracted.isEmpty) return

        val key = conversationKey(sbn)
        val now = System.currentTimeMillis()
        val messages = accumulator.accumulate(key, extracted.inboundMessages, extracted.sender, now)
        val sender = accumulator.senderFor(key) ?: extracted.sender

        // 4. Debounce — apps re-post the same notification repeatedly (typing/delivery ticks).
        //    Reschedule the draft on each repost; only the quiet-final state drafts.
        pendingDrafts.remove(key)?.cancel()
        pendingDrafts[key] = scope.launch {
            delay(DEBOUNCE_MS)
            draftAndStage(messages, sender, now)
            pendingDrafts.remove(key)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        val key = runCatching { conversationKey(sbn) }.getOrNull() ?: return
        pendingDrafts.remove(key)?.cancel()
        accumulator.forget(key)
    }

    private fun draftAndStage(messages: List<String>, sender: String?, capturedAt: Long) {
        val token = KeyboardTokenStore.getToken(this)
        if (token == null) {
            // Token not provisioned yet — stage messages so the keyboard drafts on pickup.
            CaptureStagingStore.stage(
                this,
                StagedDraft.needsDraft(messages, FlynnApi.Source.NOTIFICATION, sender, capturedAt),
            )
            return
        }
        scope.launch {
            try {
                val drafts = FlynnApi.fetchDrafts(messages, token, FlynnApi.Source.NOTIFICATION)
                val staged = if (drafts.isEmpty()) {
                    StagedDraft.needsDraft(messages, FlynnApi.Source.NOTIFICATION, sender, capturedAt)
                } else {
                    StagedDraft.ready(messages, drafts, FlynnApi.Source.NOTIFICATION, sender, capturedAt)
                }
                CaptureStagingStore.stage(this@FlynnNotificationListener, staged)
            } catch (_: FlynnApi.ApiError.LimitReached) {
                CaptureStagingStore.stage(
                    this@FlynnNotificationListener,
                    StagedDraft.limitReached(messages, FlynnApi.Source.NOTIFICATION, sender, capturedAt),
                )
            } catch (e: Exception) {
                Log.w(TAG, "draft failed; staging for keyboard retry", e)
                CaptureStagingStore.stage(
                    this@FlynnNotificationListener,
                    StagedDraft.needsDraft(messages, FlynnApi.Source.NOTIFICATION, sender, capturedAt),
                )
            }
        }
    }

    /** Stable per-conversation key: prefer the sharing shortcut, fall back to the notification key. */
    private fun conversationKey(sbn: StatusBarNotification): String =
        sbn.notification?.shortcutId ?: sbn.key ?: "${sbn.packageName}:${sbn.id}:${sbn.tag}"

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }

    companion object {
        private const val TAG = "FlynnNLS"
        private const val DEBOUNCE_MS = 1_200L
    }
}
