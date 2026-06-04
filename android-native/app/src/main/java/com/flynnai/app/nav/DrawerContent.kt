package com.flynnai.app.nav

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.flynnai.app.FlynnApp
import com.flynnai.app.ui.components.Mascot
import com.flynnai.app.ui.components.MascotPose
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.theme.FlynnInk
import com.flynnai.app.ui.theme.FlynnOrange
import com.flynnai.app.ui.theme.FlynnTextSecondary
import com.flynnai.app.ui.theme.FlynnTypography
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

@Composable
fun DrawerContent(
    onSettings: () -> Unit,
    onAccount: () -> Unit,
    onClose: () -> Unit,
) {
    val client = FlynnApp.instance.supabase
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        try {
            val session = client.auth.currentSessionOrNull() ?: return@LaunchedEffect
            email = session.user?.email ?: ""
            @Serializable data class Row(val full_name: String? = null)
            val row: Row = withContext(Dispatchers.IO) {
                client.postgrest.from("users")
                    .select { filter { eq("id", session.user?.id?.toString() ?: "") } }
                    .decodeSingle<Row>()
            }
            name = row.full_name ?: ""
        } catch (_: Exception) {}
    }

    Column(
        modifier = Modifier
            .fillMaxHeight()
            .width(280.dp)
            .background(OB.card),
    ) {
        // Profile header
        Row(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Mascot(MascotPose.Wave, size = 48.dp)
            Spacer(Modifier.width(12.dp))
            Column {
                Text(name.ifBlank { "Flynn" }, style = FlynnTypography.titleLarge)
                if (email.isNotBlank()) Text(email, style = FlynnTypography.bodySmall, color = FlynnTextSecondary)
            }
        }

        HorizontalDivider(color = OB.ink.copy(alpha = 0.1f))
        Spacer(Modifier.height(8.dp))

        DrawerRow(Icons.Default.Settings, "Settings") { onSettings(); onClose() }
        DrawerRow(Icons.Default.Person, "Account") { onAccount(); onClose() }

        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = OB.ink.copy(alpha = 0.1f))

        DrawerRow(Icons.Default.HelpOutline, "Help center", external = true) { onClose() }
        DrawerRow(Icons.Default.Mail, "Talk to support") { onClose() }

        Spacer(Modifier.weight(1f))
    }
}

@Composable
private fun DrawerRow(
    icon: ImageVector,
    title: String,
    external: Boolean = false,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = FlynnInk, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(14.dp))
        Text(title, style = FlynnTypography.bodyLarge, color = FlynnInk, modifier = Modifier.weight(1f))
    }
}
