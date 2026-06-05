package com.flynnai.app.feature.settings

import android.app.StatusBarManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Screenshot
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.flynnai.app.capture.CaptureSettings
import com.flynnai.app.capture.screenshot.FlynnCaptureTileService
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.theme.FlynnInk
import com.flynnai.app.ui.theme.FlynnOrange
import com.flynnai.app.ui.theme.FlynnTextSecondary
import com.flynnai.app.ui.theme.FlynnTextTertiary
import com.flynnai.app.ui.theme.FlynnTypography

/**
 * Message-capture setup. Walks the user through enabling the three capture surfaces with clear,
 * scoped permission asks:
 *   1. Notification access (primary) — gated behind a prominent disclosure dialog.
 *   2. The apps Flynn may read (strict allowlist).
 *   3. The Flynn keyboard (insertion).
 *   4. The Quick Settings capture tile (screenshot fallback).
 */
@Composable
fun CaptureSetupScreen(modifier: Modifier = Modifier, onBack: () -> Unit = {}) {
    val context = LocalContext.current

    // Refresh grant state whenever we return from a system settings screen.
    var refreshKey by remember { mutableStateOf(0) }
    val lifecycleOwner = LocalLifecycleOwner.current
    androidx.compose.runtime.DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) refreshKey++
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val notifAccessGranted = remember(refreshKey) { isNotificationAccessGranted(context) }
    var showDisclosure by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(OB.cream)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp),
    ) {
        Spacer(Modifier.height(16.dp))
        Text("Message capture", style = FlynnTypography.displayMedium)
        Spacer(Modifier.height(8.dp))
        Text(
            "Flynn drafts replies from your incoming messages so they're ready the moment you " +
                "open the keyboard. You choose exactly which apps it reads — nothing else.",
            style = FlynnTypography.bodyMedium,
            color = FlynnTextSecondary,
        )
        Spacer(Modifier.height(24.dp))

        // 1. Notification access (primary)
        SetupCard(
            icon = { StatusIcon(notifAccessGranted) },
            title = "Read new messages",
            subtitle = if (notifAccessGranted)
                "On — Flynn pre-drafts replies to incoming messages."
            else
                "Recommended. Lets Flynn draft a reply the instant a message arrives.",
            actionLabel = if (notifAccessGranted) "Manage" else "Turn on",
            onAction = {
                if (notifAccessGranted) openNotificationAccessSettings(context)
                else showDisclosure = true
            },
        )

        // 2. App allowlist — only when access is granted
        if (notifAccessGranted) {
            Spacer(Modifier.height(12.dp))
            AllowlistCard(context = context, refreshKey = refreshKey)
        }

        Spacer(Modifier.height(12.dp))

        // 3. Keyboard (insertion)
        SetupCard(
            icon = { Icon(Icons.Default.Keyboard, null, tint = FlynnOrange, modifier = Modifier.size(24.dp)) },
            title = "Flynn keyboard",
            subtitle = "Where drafts appear — tap to insert. Flynn never sends on its own.",
            actionLabel = "Set up",
            onAction = { context.startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS)) },
        )

        Spacer(Modifier.height(12.dp))

        // 4. Quick Settings capture tile (screenshot fallback)
        SetupCard(
            icon = { Icon(Icons.Default.Screenshot, null, tint = FlynnOrange, modifier = Modifier.size(24.dp)) },
            title = "Quick capture tile",
            subtitle = "For chats already open on screen. Add the Flynn tile to Quick Settings, " +
                "then tap it to capture and draft.",
            actionLabel = "Add tile",
            onAction = { requestAddTile(context) },
        )

        Spacer(Modifier.height(32.dp))
    }

    if (showDisclosure) {
        NotificationDisclosureDialog(
            onConfirm = {
                showDisclosure = false
                CaptureSettings.setNotificationDisclosureAccepted(context, true)
                openNotificationAccessSettings(context)
            },
            onDismiss = { showDisclosure = false },
        )
    }
}

@Composable
private fun NotificationDisclosureDialog(onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Let Flynn read your messages", style = FlynnTypography.headlineSmall) },
        text = {
            Text(
                "To draft replies, Flynn reads incoming messages from the apps you choose " +
                    "(like WhatsApp and SMS) and sends that message text to Flynn's servers to " +
                    "generate drafts in your voice.\n\n" +
                    "Flynn only reads the apps you enable, never sends anything on its own, and " +
                    "uses this only to draft your replies. You can turn it off anytime.",
                style = FlynnTypography.bodyMedium,
                color = FlynnTextSecondary,
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm) { Text("Continue", color = FlynnOrange) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Not now", color = FlynnTextTertiary) }
        },
        containerColor = OB.card,
    )
}

@Composable
private fun AllowlistCard(context: Context, refreshKey: Int) {
    val installed = remember(refreshKey) { CaptureSettings.installedKnownApps(context) }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(OB.card, RoundedCornerShape(14.dp))
            .padding(16.dp),
    ) {
        Text("Apps Flynn can read", style = FlynnTypography.labelMedium, color = FlynnInk,
            fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text("Only these apps. Toggle any off to exclude it.",
            style = FlynnTypography.bodySmall, color = FlynnTextSecondary)
        Spacer(Modifier.height(8.dp))
        if (installed.isEmpty()) {
            Text("No supported messaging apps found on this device yet.",
                style = FlynnTypography.bodySmall, color = FlynnTextTertiary)
        }
        installed.forEach { app ->
            var allowed by remember(refreshKey, app.packageName) {
                mutableStateOf(CaptureSettings.isAllowed(context, app.packageName))
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(app.label, style = FlynnTypography.bodyLarge, color = FlynnInk,
                    modifier = Modifier.weight(1f))
                Switch(
                    checked = allowed,
                    onCheckedChange = {
                        allowed = it
                        CaptureSettings.setAllowed(context, app.packageName, it)
                    },
                    colors = SwitchDefaults.colors(checkedTrackColor = FlynnOrange),
                )
            }
        }
    }
}

@Composable
private fun SetupCard(
    icon: @Composable () -> Unit,
    title: String,
    subtitle: String,
    actionLabel: String,
    onAction: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(OB.card, RoundedCornerShape(14.dp))
            .clickable(onClick = onAction)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        icon()
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = FlynnTypography.bodyLarge, color = FlynnInk, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(2.dp))
            Text(subtitle, style = FlynnTypography.bodySmall, color = FlynnTextSecondary)
        }
        TextButton(onClick = onAction) { Text(actionLabel, color = FlynnOrange) }
    }
}

@Composable
private fun StatusIcon(granted: Boolean) {
    if (granted) {
        Icon(Icons.Default.CheckCircle, null, tint = FlynnOrange, modifier = Modifier.size(24.dp))
    } else {
        Icon(Icons.Default.Notifications, null, tint = FlynnOrange, modifier = Modifier.size(24.dp))
    }
}

// ── platform helpers ──────────────────────────────────────────────────────────

private fun isNotificationAccessGranted(context: Context): Boolean =
    NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)

private fun openNotificationAccessSettings(context: Context) {
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { context.startActivity(intent) }
}

private fun requestAddTile(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val sbm = context.getSystemService(StatusBarManager::class.java)
        runCatching {
            sbm.requestAddTileService(
                ComponentName(context, FlynnCaptureTileService::class.java),
                context.getString(com.flynnai.app.R.string.tile_label),
                Icon.createWithResource(context, com.flynnai.app.R.drawable.ic_tile_flynn),
                context.mainExecutor,
            ) { /* result code — no-op; the system shows its own dialog */ }
        }
    }
    // Pre-33: the user adds the tile manually via the Quick Settings edit screen; nothing to launch.
}
