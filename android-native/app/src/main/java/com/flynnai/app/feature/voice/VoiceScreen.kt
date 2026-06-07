package com.flynnai.app.feature.voice

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flynnai.app.ui.components.Mascot
import com.flynnai.app.ui.components.MascotPose
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.onboarding.ob.RetroButton
import com.flynnai.app.ui.onboarding.ob.RetroField
import com.flynnai.app.ui.onboarding.ob.RetroVariant
import com.flynnai.app.ui.theme.FlynnOrange
import com.flynnai.app.ui.theme.FlynnTextSecondary
import com.flynnai.app.ui.theme.FlynnTypography

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VoiceScreen(vm: VoiceViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val written by vm.written.collectAsState()
    val learned by vm.learned.collectAsState()
    val preview by vm.preview.collectAsState()
    var showAdd by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = OB.cream,
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAdd = true },
                containerColor = OB.orange,
                contentColor = OB.cream,
            ) { Icon(Icons.Default.Add, "Add reply") }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        ) {
            // Preview section
            item {
                SectionHeader("Preview my voice")
                Spacer(Modifier.height(8.dp))
                PreviewCard(preview, onPreview = { vm.runPreview() })
                Spacer(Modifier.height(4.dp))
                Text(
                    "Flynn drafts a reply to a sample customer text using your current voice.",
                    style = FlynnTypography.bodySmall, color = FlynnTextSecondary,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp),
                )
                Spacer(Modifier.height(16.dp))
            }

            // Empty state
            if (state is VoiceState.Loaded && written.isEmpty() && learned.isEmpty()) {
                item {
                    Row(
                        Modifier.fillMaxWidth().voiceCard().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Mascot(MascotPose.Peek, size = 56.dp)
                        Spacer(Modifier.size(12.dp))
                        Text(
                            "Add a few replies so Flynn sounds like you.",
                            style = FlynnTypography.bodyMedium, color = FlynnTextSecondary,
                        )
                    }
                }
            }

            // Written samples
            if (written.isNotEmpty()) {
                item { SectionHeader("Your examples"); Spacer(Modifier.height(8.dp)) }
                items(written, key = { it.id }) { sample ->
                    SwipeToDeleteRow(
                        onDelete = { vm.deleteSample(sample.id) }
                    ) {
                        SampleRow(sample.sample_text)
                    }
                    Spacer(Modifier.height(8.dp))
                }
            }

            // Learned samples
            if (learned.isNotEmpty()) {
                item { Spacer(Modifier.height(8.dp)); SectionHeader("Learned from your replies"); Spacer(Modifier.height(8.dp)) }
                items(learned, key = { it.id }) { sample ->
                    SwipeToDeleteRow(onDelete = { vm.deleteSample(sample.id) }) {
                        SampleRow(sample.sample_text)
                    }
                    Spacer(Modifier.height(8.dp))
                }
            }

            if (state is VoiceState.Loading) {
                item {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = FlynnOrange, modifier = Modifier.padding(24.dp))
                    }
                }
            }
        }
    }

    // Add reply sheet
    if (showAdd) {
        var text by remember { mutableStateOf("") }
        ModalBottomSheet(onDismissRequest = { showAdd = false }, containerColor = OB.card) {
            Column(Modifier.padding(20.dp)) {
                Text("Add a reply", style = FlynnTypography.titleLarge)
                Spacer(Modifier.height(12.dp))
                Text(
                    "Write a reply you'd actually send — your tone, your words.",
                    style = FlynnTypography.bodySmall, color = FlynnTextSecondary,
                )
                Spacer(Modifier.height(16.dp))
                RetroField(value = text, onValueChange = { text = it }, placeholder = "Your reply")
                Spacer(Modifier.height(16.dp))
                RetroButton("Add reply", onClick = {
                    if (text.isNotBlank()) { vm.addSample(text); showAdd = false }
                }, isLoading = false)
                RetroButton("Cancel", onClick = { showAdd = false }, variant = RetroVariant.Secondary)
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun PreviewCard(preview: PreviewState, onPreview: () -> Unit) {
    Box(Modifier.fillMaxWidth().voiceCard().padding(16.dp)) {
        Column {
            Text(
                "\"Hi, are you free this week and how much would it cost?\"",
                style = FlynnTypography.bodySmall, color = FlynnTextSecondary,
            )
            Spacer(Modifier.height(10.dp))
            when (preview) {
                PreviewState.Idle -> RetroButton("Preview my voice", onClick = onPreview, isLoading = false)
                PreviewState.Loading -> Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = FlynnOrange)
                    Spacer(Modifier.size(8.dp))
                    Text("Drafting…", style = FlynnTypography.bodySmall, color = FlynnTextSecondary)
                }
                is PreviewState.Ready -> {
                    Text(preview.draft, style = FlynnTypography.bodyMedium)
                    Spacer(Modifier.height(10.dp))
                    RetroButton("Try again", onClick = onPreview, isLoading = false, variant = RetroVariant.Secondary)
                }
                PreviewState.Failed -> {
                    Text("Couldn't draft just now.", style = FlynnTypography.bodySmall, color = FlynnTextSecondary)
                    Spacer(Modifier.height(8.dp))
                    RetroButton("Retry", onClick = onPreview, isLoading = false, variant = RetroVariant.Secondary)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeToDeleteRow(onDelete: () -> Unit, content: @Composable () -> Unit) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { it == SwipeToDismissBoxValue.EndToStart }
    )
    LaunchedEffect(dismissState.currentValue) {
        if (dismissState.currentValue == SwipeToDismissBoxValue.EndToStart) onDelete()
    }
    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            Box(
                Modifier.fillMaxSize().clip(RoundedCornerShape(10.dp)).background(OB.terra).padding(end = 16.dp),
                contentAlignment = Alignment.CenterEnd,
            ) { Icon(Icons.Default.Delete, "Delete", tint = OB.cream) }
        },
        enableDismissFromStartToEnd = false,
    ) { content() }
}

@Composable
private fun SampleRow(text: String) {
    Box(
        Modifier.fillMaxWidth().voiceCard().padding(14.dp)
    ) { Text(text, style = FlynnTypography.bodyMedium) }
}

@Composable
private fun SectionHeader(title: String) {
    Text(title.uppercase(), style = FlynnTypography.labelSmall, color = FlynnTextSecondary)
}

private fun Modifier.voiceCard() = this
    .fillMaxWidth()
    .clip(RoundedCornerShape(12.dp))
    .border(2.dp, OB.ink, RoundedCornerShape(12.dp))
    .background(OB.card)
