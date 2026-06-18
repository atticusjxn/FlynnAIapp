package com.flynnai.app.feature.bookings

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flynnai.app.ui.components.Mascot
import com.flynnai.app.ui.components.MascotPose
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.theme.FlynnOrange
import com.flynnai.app.ui.theme.FlynnTextSecondary
import com.flynnai.app.ui.theme.FlynnTypography

@Composable
fun BookingsScreen(vm: BookingsViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val upcoming by vm.upcoming.collectAsState()
    val past by vm.past.collectAsState()

    when (state) {
        BookingsState.Loading -> Box(
            Modifier.fillMaxSize().background(OB.cream),
            contentAlignment = Alignment.Center,
        ) { CircularProgressIndicator(color = FlynnOrange) }

        is BookingsState.Error -> Box(
            Modifier.fillMaxSize().background(OB.cream).padding(24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Couldn't load bookings", style = FlynnTypography.titleLarge)
                Spacer(Modifier.height(8.dp))
                Text((state as BookingsState.Error).msg, style = FlynnTypography.bodySmall, color = FlynnTextSecondary)
            }
        }

        BookingsState.Loaded -> {
            if (upcoming.isEmpty() && past.isEmpty()) {
                EmptyBookings()
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().background(OB.cream),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    if (upcoming.isNotEmpty()) {
                        item { BookingsSectionHeader("Upcoming") }
                        items(upcoming, key = { it.id }) { JobCard(it) }
                    }
                    if (past.isNotEmpty()) {
                        item { Spacer(Modifier.height(4.dp)); BookingsSectionHeader("Past") }
                        items(past, key = { it.id }) { JobCard(it) }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyBookings() {
    Box(Modifier.fillMaxSize().background(OB.cream), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
            Mascot(MascotPose.Sleep, size = 96.dp)
            Spacer(Modifier.height(16.dp))
            Text("No bookings yet", style = FlynnTypography.titleLarge)
            Spacer(Modifier.height(8.dp))
            Text(
                "Jobs you book with Flynn — and ones you add — show up here, synced to your calendar.",
                style = FlynnTypography.bodyMedium, color = FlynnTextSecondary,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}

@Composable
private fun BookingsSectionHeader(title: String) {
    Text(
        title.uppercase(),
        style = FlynnTypography.labelSmall,
        color = FlynnTextSecondary,
        modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp),
    )
}

@Composable
private fun JobCard(job: JobDTO) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(2.dp, OB.ink, RoundedCornerShape(14.dp))
            .background(OB.card)
            .padding(16.dp),
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        job.client_name ?: "Unknown client",
                        style = FlynnTypography.titleMedium,
                    )
                    if (!job.service_type.isNullOrBlank()) {
                        Text(job.service_type, style = FlynnTypography.bodySmall, color = FlynnTextSecondary)
                    }
                }
                StatusPill(job.status)
            }
            if (!job.scheduled_date.isNullOrBlank() || !job.scheduled_time.isNullOrBlank()) {
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CalendarMonth, null, tint = FlynnOrange, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.size(6.dp))
                    Text(
                        listOfNotNull(job.scheduled_date, job.scheduled_time).joinToString(" · "),
                        style = FlynnTypography.bodySmall, color = FlynnTextSecondary,
                    )
                }
            }
            if (!job.location.isNullOrBlank()) {
                Spacer(Modifier.height(4.dp))
                Text("📍 ${job.location}", style = FlynnTypography.bodySmall, color = FlynnTextSecondary)
            }
        }
    }
}

@Composable
private fun StatusPill(status: String?) {
    val (label, bg) = when (status) {
        "complete" -> "Done" to OB.teal
        "in_progress" -> "In progress" to OB.mustard
        "pending" -> "Pending" to OB.orange
        else -> (status?.replaceFirstChar { it.uppercase() } ?: "New") to OB.ink.copy(alpha = 0.15f)
    }
    Box(
        Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(bg.copy(alpha = 0.18f))
            .border(1.dp, bg, RoundedCornerShape(20.dp))
            .padding(horizontal = 10.dp, vertical = 3.dp)
    ) {
        Text(label, style = FlynnTypography.labelSmall, color = bg)
    }
}
