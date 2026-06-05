package com.flynnai.app.capture.staging

import androidx.test.core.app.ApplicationProvider
import com.flynnai.app.data.api.FlynnApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class CaptureStagingStoreTest {

    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Before fun clean() = CaptureStagingStore.clear(context)
    @After fun tearDown() = CaptureStagingStore.clear(context)

    @Test
    fun `stage then peek round-trips`() {
        val draft = StagedDraft.ready(
            messages = listOf("Can you come Tuesday?"),
            drafts = listOf("Sure, Tuesday 2pm works."),
            source = FlynnApi.Source.NOTIFICATION,
            sender = "Sam",
            capturedAt = 123L,
        )
        CaptureStagingStore.stage(context, draft)
        val read = CaptureStagingStore.peek(context)
        assertNotNull(read)
        assertEquals(listOf("Can you come Tuesday?"), read!!.messages)
        assertEquals("Sam", read.sender)
        assertEquals(FlynnApi.Source.NOTIFICATION, read.source)
        assertTrue(!read.consumed)
    }

    @Test
    fun `markConsumed flips the flag`() {
        CaptureStagingStore.stage(
            context,
            StagedDraft.ready(listOf("hi"), listOf("hello"), FlynnApi.Source.SCREENSHOT, null, 1L),
        )
        CaptureStagingStore.markConsumed(context)
        assertTrue(CaptureStagingStore.peek(context)!!.consumed)
    }

    @Test
    fun `most recent stage wins`() {
        CaptureStagingStore.stage(
            context,
            StagedDraft.ready(listOf("first"), listOf("d1"), FlynnApi.Source.NOTIFICATION, "A", 1L),
        )
        CaptureStagingStore.stage(
            context,
            StagedDraft.ready(listOf("second"), listOf("d2"), FlynnApi.Source.NOTIFICATION, "B", 2L),
        )
        assertEquals(listOf("second"), CaptureStagingStore.peek(context)!!.messages)
    }

    @Test
    fun `concurrent writes never corrupt the slot`() = runBlocking {
        val jobs = (0 until 50).map { i ->
            async(Dispatchers.IO) {
                CaptureStagingStore.stage(
                    context,
                    StagedDraft.ready(listOf("m$i"), listOf("d$i"), FlynnApi.Source.NOTIFICATION, "S$i", i.toLong()),
                )
            }
        }
        jobs.awaitAll()
        // Whatever the winner, it must be a fully-readable record (no partial/corrupt JSON).
        val read = CaptureStagingStore.peek(context)
        assertNotNull(read)
        assertTrue(read!!.messages.single().startsWith("m"))
    }

    @Test
    fun `clear removes the slot`() {
        CaptureStagingStore.stage(
            context,
            StagedDraft.ready(listOf("hi"), listOf("hello"), FlynnApi.Source.CLIPBOARD, null, 1L),
        )
        CaptureStagingStore.clear(context)
        assertNull(CaptureStagingStore.peek(context))
    }
}
