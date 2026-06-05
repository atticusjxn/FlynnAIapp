package com.flynnai.app.capture.notification

import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class MessagingStyleExtractorTest {

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val me = Person.Builder().setName("Me").setKey("me").build()
    private val customer = Person.Builder().setName("Sam").setKey("sam").build()

    private fun channel() = "c"

    @Test
    fun `extracts inbound messages and drops the user's own`() {
        val style = NotificationCompat.MessagingStyle(me)
            .setConversationTitle("Sam")
            .addMessage("Hi, are you free?", 1_000, customer)
            .addMessage("Sure, when?", 2_000, me) // user's own — must be dropped
            .addMessage("Tuesday 2pm?", 3_000, customer)
        val notification = NotificationCompat.Builder(context, channel())
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setStyle(style)
            .build()

        val extracted = MessagingStyleExtractor.extract(notification)
        assertEquals(listOf("Hi, are you free?", "Tuesday 2pm?"), extracted.inboundMessages)
        assertEquals("Sam", extracted.sender)
    }

    @Test
    fun `falls back to extras when no messaging style`() {
        val notification = NotificationCompat.Builder(context, channel())
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Jordan")
            .setContentText("Can you quote a fence?")
            .build()

        val extracted = MessagingStyleExtractor.extract(notification)
        assertEquals("Jordan", extracted.sender)
        assertEquals(listOf("Can you quote a fence?"), extracted.inboundMessages)
    }

    @Test
    fun `messages without a person are treated as inbound`() {
        val style = NotificationCompat.MessagingStyle(me)
            .addMessage("System-ish line", 1_000, null as Person?)
        val notification = NotificationCompat.Builder(context, channel())
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setStyle(style)
            .build()

        val extracted = MessagingStyleExtractor.extract(notification)
        assertTrue(extracted.inboundMessages.contains("System-ish line"))
    }
}
