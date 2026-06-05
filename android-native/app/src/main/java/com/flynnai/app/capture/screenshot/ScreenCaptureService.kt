package com.flynnai.app.capture.screenshot

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import com.flynnai.app.R
import com.flynnai.app.capture.staging.CaptureStagingStore
import com.flynnai.app.capture.staging.StagedDraft
import com.flynnai.app.data.api.FlynnApi
import com.flynnai.app.keyboard.KeyboardTokenStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Foreground service (type `mediaProjection`) that captures a SINGLE screen frame, runs on-device
 * OCR, drafts a reply, stages it for the keyboard, then immediately tears everything down to
 * minimise the time the system "screen is being captured" indicator is showing.
 *
 * Order matters on Android 14+ (targetSdk 35): we must `startForeground(type=mediaProjection)`
 * with a visible notification BEFORE acquiring the projection, or the platform throws.
 */
class ScreenCaptureService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var projection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var bgThread: HandlerThread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, Int.MIN_VALUE) ?: Int.MIN_VALUE
        val data = intent?.let {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
                it.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
            else @Suppress("DEPRECATION") it.getParcelableExtra(EXTRA_RESULT_DATA)
        }

        if (resultCode == Int.MIN_VALUE || data == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        // FGS notification must be up before getMediaProjection() on Android 14+.
        startAsForeground()

        runCatching { beginCapture(resultCode, data) }
            .onFailure {
                Log.w(TAG, "capture failed", it)
                finish()
            }
        return START_NOT_STICKY
    }

    private fun startAsForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.capture_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply { setShowBadge(false) }
            nm.createNotificationChannel(channel)
        }
        val notification: Notification =
            androidx.core.app.NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(getString(R.string.capture_notification_title))
                .setContentText(getString(R.string.capture_notification_text))
                .setSmallIcon(R.drawable.ic_tile_flynn)
                .setOngoing(true)
                .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIF_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION,
            )
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    private fun beginCapture(resultCode: Int, data: Intent) {
        val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val mp = mpm.getMediaProjection(resultCode, data) ?: run { finish(); return }
        projection = mp

        // Android 14+ requires a registered callback before creating the virtual display.
        mp.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() { finish() }
        }, Handler(mainLooper))

        val metrics = screenMetrics()
        val width = metrics.first
        val height = metrics.second
        val density = metrics.third

        val thread = HandlerThread("flynn-capture").also { it.start() }
        bgThread = thread
        val handler = Handler(thread.looper)

        val reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        imageReader = reader

        virtualDisplay = mp.createVirtualDisplay(
            "flynn-capture",
            width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.surface,
            null,
            handler,
        )

        reader.setOnImageAvailableListener({ r ->
            val image = r.acquireLatestImage() ?: return@setOnImageAvailableListener
            // Only the first frame is needed — detach the listener immediately.
            r.setOnImageAvailableListener(null, null)
            val bitmap = runCatching { image.toBitmap(width) }.getOrNull()
            image.close()
            // Stop projection ASAP to drop the recording indicator.
            teardownCapture()
            if (bitmap == null) { finish(); return@setOnImageAvailableListener }
            scope.launch { ocrDraftStage(bitmap) }
        }, handler)
    }

    private suspend fun ocrDraftStage(bitmap: Bitmap) {
        val now = System.currentTimeMillis()
        val text = runCatching { OcrTextExtractor.recognize(bitmap) }.getOrNull()
        bitmap.recycle()
        if (text.isNullOrBlank()) { finish(); return }

        val messages = listOf(text)
        val token = KeyboardTokenStore.getToken(this)
        if (token == null) {
            CaptureStagingStore.stage(
                this,
                StagedDraft.needsDraft(messages, FlynnApi.Source.SCREENSHOT, null, now),
            )
            finish(); return
        }
        try {
            val drafts = FlynnApi.fetchDrafts(messages, token, FlynnApi.Source.SCREENSHOT)
            val staged = if (drafts.isEmpty())
                StagedDraft.needsDraft(messages, FlynnApi.Source.SCREENSHOT, null, now)
            else
                StagedDraft.ready(messages, drafts, FlynnApi.Source.SCREENSHOT, null, now)
            CaptureStagingStore.stage(this, staged)
        } catch (_: FlynnApi.ApiError.LimitReached) {
            CaptureStagingStore.stage(
                this,
                StagedDraft.limitReached(messages, FlynnApi.Source.SCREENSHOT, null, now),
            )
        } catch (e: Exception) {
            Log.w(TAG, "screenshot draft failed; staging for keyboard retry", e)
            CaptureStagingStore.stage(
                this,
                StagedDraft.needsDraft(messages, FlynnApi.Source.SCREENSHOT, null, now),
            )
        } finally {
            finish()
        }
    }

    @Suppress("DEPRECATION")
    private fun screenMetrics(): Triple<Int, Int, Int> {
        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = wm.currentWindowMetrics.bounds
            val density = resources.configuration.densityDpi
            Triple(bounds.width(), bounds.height(), density)
        } else {
            val dm = DisplayMetrics()
            wm.defaultDisplay.getRealMetrics(dm)
            Triple(dm.widthPixels, dm.heightPixels, dm.densityDpi)
        }
    }

    private fun teardownCapture() {
        runCatching { virtualDisplay?.release() }; virtualDisplay = null
        runCatching { imageReader?.close() }; imageReader = null
        runCatching { projection?.stop() }; projection = null
        runCatching { bgThread?.quitSafely() }; bgThread = null
    }

    private fun finish() {
        teardownCapture()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION") stopForeground(true)
        }
        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        teardownCapture()
        scope.cancel()
    }

    companion object {
        private const val TAG = "FlynnCapture"
        private const val CHANNEL_ID = "flynn_capture"
        private const val NOTIF_ID = 4711
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_RESULT_DATA = "result_data"

        fun start(context: Context, resultCode: Int, data: Intent) {
            val intent = Intent(context, ScreenCaptureService::class.java).apply {
                putExtra(EXTRA_RESULT_CODE, resultCode)
                putExtra(EXTRA_RESULT_DATA, data)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}

/** Convert a single RGBA_8888 [Image] to a cropped [Bitmap], accounting for row padding. */
private fun Image.toBitmap(targetWidth: Int): Bitmap {
    val plane = planes[0]
    val pixelStride = plane.pixelStride
    val rowStride = plane.rowStride
    val rowPadding = rowStride - pixelStride * width
    val bitmap = Bitmap.createBitmap(
        width + rowPadding / pixelStride,
        height,
        Bitmap.Config.ARGB_8888,
    )
    bitmap.copyPixelsFromBuffer(plane.buffer)
    return if (bitmap.width > targetWidth)
        Bitmap.createBitmap(bitmap, 0, 0, targetWidth, height)
    else bitmap
}
