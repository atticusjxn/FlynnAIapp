package com.flynnai.app.capture

import android.content.Context
import android.content.pm.PackageManager

/**
 * User-controlled configuration for what Flynn is allowed to read. This is the privacy contract:
 * Flynn only ever reads notifications from packages the user explicitly enables here — never a
 * blanket "read everything." Stored in plain (non-encrypted) prefs; the data is non-sensitive
 * (a list of package names the user chose).
 */
object CaptureSettings {
    private const val PREF_FILE = "flynn_capture_settings"
    private const val KEY_ALLOWLIST = "allowed_packages"
    private const val KEY_NOTIF_DISCLOSURE_ACCEPTED = "notif_disclosure_accepted"

    /** Messaging apps Flynn knows how to read, with display labels. Order = onboarding order. */
    val KNOWN_MESSAGING_APPS: List<KnownApp> = listOf(
        KnownApp("com.whatsapp", "WhatsApp"),
        KnownApp("com.google.android.apps.messaging", "Messages (SMS)"),
        KnownApp("com.facebook.orca", "Messenger"),
        KnownApp("org.thoughtcrime.securesms", "Signal"),
        KnownApp("com.whatsapp.w4b", "WhatsApp Business"),
        KnownApp("com.instagram.android", "Instagram"),
    )

    /** Sensible defaults: the two highest-coverage, most-reliable messaging surfaces. */
    private val DEFAULT_ALLOWLIST = setOf(
        "com.whatsapp",
        "com.google.android.apps.messaging",
    )

    data class KnownApp(val packageName: String, val label: String)

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE)

    /** Packages the user has allowed Flynn to read. Defaults applied on first read. */
    fun allowedPackages(context: Context): Set<String> {
        val p = prefs(context)
        if (!p.contains(KEY_ALLOWLIST)) {
            p.edit().putStringSet(KEY_ALLOWLIST, DEFAULT_ALLOWLIST).apply()
            return DEFAULT_ALLOWLIST
        }
        return p.getStringSet(KEY_ALLOWLIST, DEFAULT_ALLOWLIST) ?: DEFAULT_ALLOWLIST
    }

    fun isAllowed(context: Context, packageName: String): Boolean =
        packageName in allowedPackages(context)

    fun setAllowed(context: Context, packageName: String, allowed: Boolean) {
        val current = allowedPackages(context).toMutableSet()
        if (allowed) current.add(packageName) else current.remove(packageName)
        prefs(context).edit().putStringSet(KEY_ALLOWLIST, current).apply()
    }

    /** Whether the user has seen and accepted the notification-reading prominent disclosure. */
    fun notificationDisclosureAccepted(context: Context): Boolean =
        prefs(context).getBoolean(KEY_NOTIF_DISCLOSURE_ACCEPTED, false)

    fun setNotificationDisclosureAccepted(context: Context, accepted: Boolean) =
        prefs(context).edit().putBoolean(KEY_NOTIF_DISCLOSURE_ACCEPTED, accepted).apply()

    /** Known messaging apps that are actually installed on this device, for the picker. */
    fun installedKnownApps(context: Context): List<KnownApp> {
        val pm = context.packageManager
        return KNOWN_MESSAGING_APPS.filter { app ->
            runCatching {
                pm.getPackageInfo(app.packageName, 0)
                true
            }.getOrDefault(false)
        }
    }
}
