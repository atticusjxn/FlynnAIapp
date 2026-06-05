package com.flynnai.app.capture.notification

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ConversationAccumulatorTest {

    @Test
    fun `accumulates distinct inbound messages oldest to newest`() {
        val acc = ConversationAccumulator()
        acc.accumulate("k", listOf("Hi"), "Sam", 1_000)
        val result = acc.accumulate("k", listOf("Can you come Tuesday?"), "Sam", 2_000)
        assertEquals(listOf("Hi", "Can you come Tuesday?"), result)
        assertEquals("Sam", acc.senderFor("k"))
    }

    @Test
    fun `dedupes repeated messages`() {
        val acc = ConversationAccumulator()
        acc.accumulate("k", listOf("Hi"), null, 1)
        val result = acc.accumulate("k", listOf("Hi", "Hi"), null, 2)
        assertEquals(listOf("Hi"), result)
    }

    @Test
    fun `caps thread length and drops oldest`() {
        val acc = ConversationAccumulator(maxMessagesPerThread = 3)
        acc.accumulate("k", listOf("a", "b", "c"), null, 1)
        val result = acc.accumulate("k", listOf("d"), null, 2)
        assertEquals(listOf("b", "c", "d"), result)
    }

    @Test
    fun `threads are isolated by key`() {
        val acc = ConversationAccumulator()
        acc.accumulate("a", listOf("from A"), "A", 1)
        acc.accumulate("b", listOf("from B"), "B", 1)
        assertEquals(listOf("from A"), acc.accumulate("a", emptyList(), null, 2))
        assertEquals("B", acc.senderFor("b"))
    }

    @Test
    fun `forget clears a thread`() {
        val acc = ConversationAccumulator()
        acc.accumulate("k", listOf("hi"), "S", 1)
        acc.forget("k")
        assertNull(acc.senderFor("k"))
    }

    @Test
    fun `sender persists when a later notification omits it`() {
        val acc = ConversationAccumulator()
        acc.accumulate("k", listOf("hi"), "Sam", 1)
        acc.accumulate("k", listOf("again"), null, 2)
        assertEquals("Sam", acc.senderFor("k"))
    }
}
