package com.flynnai.app.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flynnai.app.ui.components.Mascot
import com.flynnai.app.ui.components.MascotPose
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.theme.FlynnOrange
import com.flynnai.app.ui.theme.FlynnTextSecondary
import com.flynnai.app.ui.theme.FlynnTypography
import java.util.Calendar

@Composable
fun HomeScreen(vm: HomeViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val firstName by vm.firstName.collectAsState()
    val keyboardAdded by vm.keyboardAdded.collectAsState()
    val calendarConnected by vm.calendarConnected.collectAsState()
    val recentReplies by vm.recentReplies.collectAsState()

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(OB.cream),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            horizontal = 20.dp, vertical = 16.dp
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Greeting
        item {
            Column {
                Text(greeting(), style = FlynnTypography.labelMedium, color = FlynnTextSecondary)
                Text(firstName?.let { "Hey, $it." } ?: "Flynn", style = FlynnTypography.displayMedium)
                Spacer(Modifier.height(4.dp))
                val setupDone = keyboardAdded && calendarConnected
                Text(
                    if (setupDone) "You're set — copy a message and tap the Flynn keyboard."
                    else "Finish setup to start replying with Flynn.",
                    style = FlynnTypography.bodyMedium, color = FlynnTextSecondary,
                )
            }
        }

        // Setup card (only when incomplete)
        if (state is HomeState.Loaded && (!keyboardAdded || !calendarConnected)) {
            item {
                DashCard {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Check, null, tint = FlynnOrange, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.size(8.dp))
                            Text("Finish setting up Flynn", style = FlynnTypography.titleLarge)
                            Spacer(Modifier.weight(1f))
                            val done = (if (keyboardAdded) 1 else 0) + (if (calendarConnected) 1 else 0)
                            Text("$done / 2", style = FlynnTypography.labelMedium, color = FlynnTextSecondary)
                        }
                        HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp), color = OB.ink.copy(alpha = 0.1f))
                        SetupRow(Icons.Default.Keyboard, "Add the Flynn keyboard",
                            "Draft replies right inside Messages", keyboardAdded)
                        Spacer(Modifier.height(8.dp))
                        SetupRow(Icons.Default.Psychology, "Connect your calendar",
                            "Offer real free times and book jobs", calendarConnected)
                    }
                }
            }
        }

        // How Flynn works
        item {
            DashCard {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Mascot(MascotPose.Point, size = 44.dp)
                        Spacer(Modifier.size(10.dp))
                        Text("How Flynn works", style = FlynnTypography.titleLarge)
                    }
                    HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp), color = OB.ink.copy(alpha = 0.1f))
                    listOf(
                        "1. Copy a customer's message",
                        "2. Switch to the Flynn keyboard",
                        "3. Tap a reply — it's already written",
                    ).forEach {
                        Text(it, style = FlynnTypography.bodyMedium, modifier = Modifier.padding(vertical = 3.dp))
                    }
                }
            }
        }

        // Recent replies
        if (state is HomeState.Loaded && recentReplies.isNotEmpty()) {
            item {
                Text("Recent replies", style = FlynnTypography.titleLarge)
            }
            items(recentReplies.size) { i ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .border(1.5.dp, OB.ink.copy(alpha = 0.15f), RoundedCornerShape(10.dp))
                        .background(OB.card)
                        .padding(12.dp),
                ) {
                    Text(recentReplies[i], style = FlynnTypography.bodyMedium)
                }
            }
        }

        // Loading
        if (state is HomeState.Loading) {
            item {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = FlynnOrange)
                }
            }
        }
    }
}

@Composable
private fun DashCard(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(2.dp, OB.ink, RoundedCornerShape(14.dp))
            .background(OB.card)
            .padding(16.dp),
    ) { content() }
}

@Composable
private fun SetupRow(icon: ImageVector, title: String, subtitle: String, done: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = if (done) OB.teal else OB.orange, modifier = Modifier.size(22.dp))
        Spacer(Modifier.size(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = FlynnTypography.labelLarge)
            Text(subtitle, style = FlynnTypography.bodySmall, color = FlynnTextSecondary)
        }
        if (done) Icon(Icons.Default.CheckCircle, null, tint = OB.teal, modifier = Modifier.size(20.dp))
    }
}

private fun greeting(): String {
    return when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
        in 5..11 -> "Good morning"
        in 12..16 -> "Good afternoon"
        else -> "Good evening"
    }
}
