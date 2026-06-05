package com.flynnai.app.capture.screenshot

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts

/**
 * Transparent, no-UI activity that requests the per-session MediaProjection consent (the system
 * "Start recording or casting?" dialog) and, on approval, hands the result to
 * [ScreenCaptureService]. A `TileService` cannot show this dialog itself, so the tile launches
 * this activity. Android 14+ requires fresh consent for every capture — there is no persistent
 * grant, which keeps capture honestly on-invoke.
 */
class MediaProjectionConsentActivity : ComponentActivity() {

    private val launcher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            ScreenCaptureService.start(this, result.resultCode, result.data!!)
        }
        finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        runCatching { launcher.launch(mpm.createScreenCaptureIntent()) }
            .onFailure { finish() }
    }

    companion object {
        fun newIntent(context: Context): Intent =
            Intent(context, MediaProjectionConsentActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            }
    }
}
