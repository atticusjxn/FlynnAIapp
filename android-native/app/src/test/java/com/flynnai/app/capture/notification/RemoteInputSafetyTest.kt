package com.flynnai.app.capture.notification

import org.junit.Assert.assertFalse
import org.junit.Test
import java.io.File

/**
 * Structural guard for Flynn's "never autonomous" principle. The notification listener must read
 * notifications ONLY — it must never fire another app's Direct-Reply action, which would SEND a
 * message. This test fails the build if the listener source references any send-capable API.
 */
class RemoteInputSafetyTest {

    private val forbidden = listOf(
        "RemoteInput",
        "getResultsFromIntent",
        "addResultsToIntent",
        ".send(", // PendingIntent.send
        "notification.actions",
        "getActions(",
    )

    @Test
    fun `listener never references send-capable APIs`() {
        val source = locateSource("FlynnNotificationListener.kt")
        val code = source.readText()
            .lineSequence()
            .filterNot { it.trimStart().startsWith("//") || it.trimStart().startsWith("*") }
            .joinToString("\n")

        for (token in forbidden) {
            assertFalse(
                "FlynnNotificationListener must not reference '$token' (would enable autonomous send)",
                code.contains(token),
            )
        }
    }

    private fun locateSource(fileName: String): File {
        // Tests run with the module dir as CWD; fall back to walking up if needed.
        val candidates = listOf(
            File("src/main/java/com/flynnai/app/capture/notification/$fileName"),
            File("app/src/main/java/com/flynnai/app/capture/notification/$fileName"),
        )
        return candidates.firstOrNull { it.exists() }
            ?: File(".").walkTopDown().first { it.name == fileName }
    }
}
