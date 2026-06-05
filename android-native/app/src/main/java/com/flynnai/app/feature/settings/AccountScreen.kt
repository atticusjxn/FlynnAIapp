package com.flynnai.app.feature.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.flynnai.app.FlynnApp
import com.flynnai.app.core.Environment
import com.flynnai.app.data.api.KeyboardBridge
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.theme.FlynnInk
import com.flynnai.app.ui.theme.FlynnOrange
import com.flynnai.app.ui.theme.FlynnTextSecondary
import com.flynnai.app.ui.theme.FlynnTextTertiary
import com.flynnai.app.ui.theme.FlynnTypography
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@Composable
fun AccountScreen(modifier: Modifier = Modifier, onSignedOut: () -> Unit = {}, onBack: () -> Unit = {}) {
    val client = FlynnApp.instance.supabase
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var working by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            val session = client.auth.currentSessionOrNull() ?: return@LaunchedEffect
            email = session.user?.email ?: ""
            @Serializable data class Row(val full_name: String? = null)
            val row: Row = withContext(Dispatchers.IO) {
                client.postgrest.from("users")
                    .select { filter { eq("id", session.user?.id?.toString() ?: "") } }
                    .decodeSingle()
            }
            name = row.full_name ?: ""
        } catch (_: Exception) {}
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(OB.cream)
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
    ) {
        Text("Account", style = FlynnTypography.displayMedium)
        Spacer(Modifier.height(20.dp))

        // Profile card
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .border(2.dp, OB.ink, RoundedCornerShape(14.dp))
                .background(OB.card)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val initial = (if (name.isNotBlank()) name else email).firstOrNull()?.uppercaseChar()?.toString() ?: "F"
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(FlynnOrange),
                contentAlignment = Alignment.Center,
            ) {
                Text(initial, style = FlynnTypography.headlineMedium, color = Color.White)
            }
            Spacer(Modifier.size(14.dp))
            Column {
                Text(name.ifBlank { "Flynn" }, style = FlynnTypography.titleLarge)
                if (email.isNotBlank()) Text(email, style = FlynnTypography.bodySmall, color = FlynnTextSecondary)
            }
        }

        Spacer(Modifier.height(24.dp))
        SettingsSection("Subscription") {
            AccountRow(Icons.Default.CreditCard, "Manage subscription") {}
        }

        SettingsSection("Account") {
            AccountRow(Icons.Default.ExitToApp, "Sign out") {
                scope.launch {
                    KeyboardBridge.clear(context)
                    client.auth.signOut()
                    onSignedOut()
                }
            }
            androidx.compose.material3.HorizontalDivider(
                modifier = Modifier.padding(horizontal = 16.dp),
                color = OB.ink.copy(alpha = 0.08f),
            )
            AccountRow(Icons.Default.Delete, "Delete account", destructive = true) {
                showDeleteDialog = true
            }
        }
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete account?") },
            text = { Text("This permanently deletes your account and all data. This can't be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteDialog = false
                    scope.launch {
                        working = true
                        try {
                            val token = client.auth.currentAccessTokenOrNull() ?: return@launch
                            withContext(Dispatchers.IO) {
                                OkHttpClient().newCall(
                                    Request.Builder()
                                        .url("${Environment.flynnApiBaseUrl}/me/account/delete")
                                        .post("{}".toRequestBody("application/json".toMediaType()))
                                        .addHeader("Authorization", "Bearer $token")
                                        .build()
                                ).execute()
                            }
                            KeyboardBridge.clear(context)
                            client.auth.signOut()
                            onSignedOut()
                        } catch (_: Exception) {}
                        working = false
                    }
                }) { Text("Delete", color = Color(0xFFEF4444)) }
            },
            dismissButton = { TextButton(onClick = { showDeleteDialog = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun AccountRow(
    icon: ImageVector,
    title: String,
    destructive: Boolean = false,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = if (destructive) Color(0xFFEF4444) else FlynnOrange, modifier = Modifier.size(22.dp))
        Spacer(Modifier.size(14.dp))
        Text(title, style = FlynnTypography.bodyLarge,
            color = if (destructive) Color(0xFFEF4444) else FlynnInk, modifier = Modifier.weight(1f))
        Icon(Icons.Default.ArrowForward, null, tint = FlynnTextTertiary, modifier = Modifier.size(18.dp))
    }
}
