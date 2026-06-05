package com.flynnai.app.capture.screenshot

import android.app.PendingIntent
import android.os.Build
import android.service.quicksettings.TileService
import androidx.annotation.RequiresApi

/**
 * Quick Settings tile that triggers an on-screen capture. One tap from anywhere on the device →
 * MediaProjection consent → one-frame capture → OCR → draft staged → open Flynn keyboard to insert.
 *
 * This is Flynn's "capture what's on screen now" gesture — the fallback for when a notification
 * isn't available (chat already open, notification dismissed) or fuller on-screen context is needed.
 */
class FlynnCaptureTileService : TileService() {

    override fun onClick() {
        super.onClick()
        val consent = MediaProjectionConsentActivity.newIntent(this)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Android 14+: the Intent overload of startActivityAndCollapse is deprecated/throws.
            startActivityAndCollapsePending(consent)
        } else {
            @Suppress("DEPRECATION", "StartActivityAndCollapseDeprecated")
            startActivityAndCollapse(consent)
        }
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private fun startActivityAndCollapsePending(consent: android.content.Intent) {
        val pi = PendingIntent.getActivity(
            this, 0, consent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        startActivityAndCollapse(pi)
    }
}
