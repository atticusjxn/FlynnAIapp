package com.flynnai.app.feature.settings

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Brush
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.theme.FlynnInk
import com.flynnai.app.ui.theme.FlynnOrange
import com.flynnai.app.ui.theme.FlynnTextSecondary
import com.flynnai.app.ui.theme.FlynnTextTertiary
import com.flynnai.app.ui.theme.FlynnTypography

@Composable
fun SettingsScreen(
    modifier: Modifier = Modifier,
    onNavigateToSubscription: () -> Unit = {},
    onNavigateToCapture: () -> Unit = {},
) {
    val context = LocalContext.current
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(OB.cream)
            .verticalScroll(rememberScrollState()),
    ) {
        Spacer(Modifier.height(16.dp))
        Text("Settings", style = FlynnTypography.displayMedium, modifier = Modifier.padding(horizontal = 20.dp))
        Spacer(Modifier.height(20.dp))

        SettingsSection("Setup") {
            SettingsRow(Icons.Default.ChatBubbleOutline, "Message capture",
                subtitle = "How Flynn reads messages to draft replies",
                onClick = onNavigateToCapture)
            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp), color = OB.ink.copy(alpha = 0.08f))
            SettingsRow(Icons.Default.CalendarMonth, "Calendar & Keyboard",
                subtitle = "Connect integrations") {
                context.startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
            }
        }

        SettingsSection("Preferences") {
            SettingsRow(Icons.Default.Brush, "Appearance") {}
        }

        SettingsSection("Billing") {
            SettingsRow(Icons.Default.CreditCard, "Subscription",
                subtitle = "Manage your plan", onClick = onNavigateToSubscription)
        }
    }
}

@Composable
fun SettingsSection(title: String, content: @Composable () -> Unit) {
    Text(
        title.uppercase(),
        style = FlynnTypography.labelSmall,
        color = FlynnTextTertiary,
        modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp),
    )
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .background(OB.card, androidx.compose.foundation.shape.RoundedCornerShape(12.dp)),
    ) { content() }
    Spacer(Modifier.height(20.dp))
}

@Composable
fun SettingsRow(
    icon: ImageVector,
    title: String,
    subtitle: String? = null,
    external: Boolean = false,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = FlynnOrange, modifier = Modifier.size(22.dp))
        Spacer(Modifier.size(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = FlynnTypography.bodyLarge, color = FlynnInk)
            if (subtitle != null) Text(subtitle, style = FlynnTypography.bodySmall, color = FlynnTextSecondary)
        }
        Icon(
            if (external) Icons.AutoMirrored.Filled.OpenInNew else Icons.Default.ChevronRight,
            null, tint = FlynnTextTertiary, modifier = Modifier.size(18.dp),
        )
    }
}
