package com.flynnai.app.capture.screenshot

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * On-device OCR over a captured screen frame. Uses ML Kit Text Recognition (GMS-delivered model,
 * downloaded once via Play Services — keeps the APK lean). Fully offline after the first model
 * fetch; the bitmap never leaves the device.
 *
 * Reading order is reconstructed by sorting text blocks top→bottom, then left→right, so the
 * resulting string roughly matches how the conversation reads on screen.
 */
object OcrTextExtractor {

    private val recognizer by lazy {
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    }

    /** Returns the recognized conversation text, or null if nothing legible was found. */
    suspend fun recognize(bitmap: Bitmap): String? = suspendCancellableCoroutine { cont ->
        val image = InputImage.fromBitmap(bitmap, 0)
        recognizer.process(image)
            .addOnSuccessListener { visionText ->
                val text = visionText.textBlocks
                    .sortedWith(
                        compareBy(
                            { it.boundingBox?.top ?: 0 },
                            { it.boundingBox?.left ?: 0 },
                        ),
                    )
                    .joinToString("\n") { it.text }
                    .trim()
                cont.resume(text.ifBlank { null })
            }
            .addOnFailureListener { e ->
                if (cont.isActive) cont.resumeWithException(e)
            }
    }
}
