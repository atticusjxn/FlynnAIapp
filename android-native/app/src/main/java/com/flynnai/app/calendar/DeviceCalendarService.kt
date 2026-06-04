package com.flynnai.app.calendar

import android.Manifest
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import java.util.TimeZone

// Mirrors iOS AppleCalendarService — thin wrapper over CalendarContract.
// Requires READ_CALENDAR + WRITE_CALENDAR permissions (in manifest).
class DeviceCalendarService(private val context: Context) {

    sealed class CalendarError(msg: String) : Exception(msg) {
        data object AccessDenied : CalendarError("Calendar access is disabled in Settings")
        data object NoCalendar : CalendarError("No writable calendar found on device")
    }

    fun hasPermission(): Boolean = ContextCompat.checkSelfPermission(
        context, Manifest.permission.READ_CALENDAR
    ) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.WRITE_CALENDAR
            ) == PackageManager.PERMISSION_GRANTED

    // Returns the primary calendar ID, or null if none found
    private fun primaryCalendarId(): Long? {
        val uri = CalendarContract.Calendars.CONTENT_URI
        val projection = arrayOf(CalendarContract.Calendars._ID, CalendarContract.Calendars.IS_PRIMARY)
        val cursor = context.contentResolver.query(uri, projection, null, null, null)
        cursor?.use { c ->
            while (c.moveToNext()) {
                val id = c.getLong(0)
                val primary = c.getInt(1)
                if (primary == 1) return id
            }
            // fallback: first calendar
            if (c.moveToFirst()) return c.getLong(0)
        }
        return null
    }

    // Returns the event ID — store in jobs.calendar_event_id for later updates/deletes.
    fun createEvent(
        title: String,
        description: String? = null,
        location: String? = null,
        startMs: Long,
        durationMinutes: Int = 60,
    ): Long {
        if (!hasPermission()) throw CalendarError.AccessDenied
        val calId = primaryCalendarId() ?: throw CalendarError.NoCalendar
        val endMs = startMs + durationMinutes * 60_000L
        val values = ContentValues().apply {
            put(CalendarContract.Events.CALENDAR_ID, calId)
            put(CalendarContract.Events.TITLE, title)
            if (description != null) put(CalendarContract.Events.DESCRIPTION, description)
            if (location != null) put(CalendarContract.Events.EVENT_LOCATION, location)
            put(CalendarContract.Events.DTSTART, startMs)
            put(CalendarContract.Events.DTEND, endMs)
            put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
        }
        val uri = context.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
            ?: throw RuntimeException("Failed to insert calendar event")
        return ContentUris.parseId(uri)
    }

    fun deleteEvent(eventId: Long) {
        if (!hasPermission()) return
        val uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId)
        context.contentResolver.delete(uri, null, null)
    }

    // Returns free/busy slots for the next N days (busy times from the primary calendar)
    fun busySlots(lookaheadDays: Int = 7): List<Pair<Long, Long>> {
        if (!hasPermission()) return emptyList()
        val now = System.currentTimeMillis()
        val end = now + lookaheadDays * 24 * 3600_000L
        val uri = CalendarContract.Instances.CONTENT_URI.buildUpon()
            .appendPath(now.toString()).appendPath(end.toString()).build()
        val projection = arrayOf(
            CalendarContract.Instances.BEGIN,
            CalendarContract.Instances.END,
        )
        val result = mutableListOf<Pair<Long, Long>>()
        context.contentResolver.query(uri, projection, null, null, null)?.use { c ->
            while (c.moveToNext()) result.add(Pair(c.getLong(0), c.getLong(1)))
        }
        return result
    }
}
