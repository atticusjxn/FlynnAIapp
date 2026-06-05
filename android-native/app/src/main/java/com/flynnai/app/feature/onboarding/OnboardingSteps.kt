package com.flynnai.app.feature.onboarding

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Stars
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.flynnai.app.ui.components.MascotPose
import com.flynnai.app.ui.onboarding.ob.MascotHero
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.onboarding.ob.OnboardingHeadline
import com.flynnai.app.ui.onboarding.ob.OnboardingScaffold
import com.flynnai.app.ui.onboarding.ob.RetroButton
import com.flynnai.app.ui.onboarding.ob.RetroField
import com.flynnai.app.ui.onboarding.ob.RetroVariant
import com.flynnai.app.ui.theme.FlynnTypography
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

// ─── Welcome ───────────────────────────────────────────────────

@Composable
fun WelcomeStep(onContinue: () -> Unit) {
    OnboardingScaffold(variant = 0, footer = { RetroButton("Get started", onContinue) }) {
        Spacer(Modifier.height(16.dp))
        MascotHero(MascotPose.Wave, size = 200.dp)
        Spacer(Modifier.height(28.dp))
        OnboardingHeadline(title = "Reply like you.", accentTitle = "Lock in the time.")
        Spacer(Modifier.height(16.dp))
        Text(
            "Flynn drafts your texts in your own voice and books the moment everyone agrees — for clients, side gigs, or just your group chat.",
            style = FlynnTypography.bodyLarge.copy(color = OB.ink.copy(alpha = 0.75f)),
        )
    }
}

// ─── What You Do ───────────────────────────────────────────────

@Composable
fun WhatYouDoStep(vm: OnboardingViewModel, onContinue: () -> Unit) {
    val desc by vm.businessDescription.collectAsState()
    val url by vm.websiteURL.collectAsState()
    val state by vm.understandingState.collectAsState()
    val scope = rememberCoroutineScope()

    OnboardingScaffold(
        variant = 1,
        footer = {
            RetroButton(
                title = "Continue",
                onClick = {
                    scope.launch {
                        vm.understandBusiness()
                        // wait for state change — observe via LaunchedEffect in real flow
                    }
                },
                isLoading = state is LoadState.Loading,
                enabled = desc.isNotBlank() && state !is LoadState.Loading,
            )
        },
    ) {
        Row(verticalAlignment = Alignment.Top) {
            OnboardingHeadline(
                eyebrow = "Step 1",
                title = "What's Flynn",
                accentTitle = "helping with?",
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            com.flynnai.app.ui.components.Mascot(MascotPose.Thinking, size = 76.dp)
        }
        Spacer(Modifier.height(8.dp))
        Text("A line is plenty — works for any job, hustle, or just you.",
            style = FlynnTypography.bodyMedium.copy(color = OB.ink.copy(alpha = 0.65f)))
        Spacer(Modifier.height(20.dp))
        RetroField(value = desc, onValueChange = { vm.businessDescription.value = it },
            placeholder = "plumber · real estate agent · hairdresser…")
        Spacer(Modifier.height(12.dp))
        RetroField(value = url, onValueChange = { vm.websiteURL.value = it },
            placeholder = "Website (optional)",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
        if (state is LoadState.Error) {
            Spacer(Modifier.height(12.dp))
            Text((state as LoadState.Error).msg, style = FlynnTypography.bodySmall, color = OB.terra)
        }
        // Auto-advance when loaded
        if (state is LoadState.Loaded) {
            androidx.compose.runtime.LaunchedEffect(Unit) { onContinue() }
        }
    }
}

// ─── Confirm Brain ──────────────────────────────────────────────

@Composable
fun ConfirmBrainStep(vm: OnboardingViewModel, onContinue: () -> Unit) {
    val businessType by vm.detectedBusinessType.collectAsState()
    val services by vm.detectedServices.collectAsState()
    val pricingNote by vm.detectedPricingNote.collectAsState()
    var saving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    OnboardingScaffold(
        variant = 2,
        footer = {
            RetroButton("Looks right", onClick = {
                saving = true
                scope.launch {
                    withContext(Dispatchers.IO) { vm.saveBusinessBrain() }
                    saving = false
                    onContinue()
                }
            }, isLoading = saving)
        },
    ) {
        OnboardingHeadline(eyebrow = "Step 2", title = "Does this", accentTitle = "look right?")
        Spacer(Modifier.height(8.dp))
        Text("Fix anything that's off — you can always edit later.",
            style = FlynnTypography.bodyMedium.copy(color = OB.ink.copy(alpha = 0.65f)))
        Spacer(Modifier.height(20.dp))
        RetroField(value = businessType, onValueChange = { vm.detectedBusinessType.value = it },
            placeholder = "What you do")
        if (services.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Text("Services & rough pricing", style = FlynnTypography.labelMedium, color = OB.ink.copy(alpha = 0.6f))
            services.forEachIndexed { i, svc ->
                Spacer(Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    RetroField(value = svc.name, onValueChange = {
                        vm.detectedServices.value = services.toMutableList().apply { this[i] = svc.copy(name = it) }
                    }, placeholder = "Service", modifier = Modifier.weight(1f))
                    RetroField(value = svc.priceRange, onValueChange = {
                        vm.detectedServices.value = services.toMutableList().apply { this[i] = svc.copy(priceRange = it) }
                    }, placeholder = "Price", modifier = Modifier.weight(0.6f),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        RetroField(value = pricingNote, onValueChange = { vm.detectedPricingNote.value = it },
            placeholder = "Pricing notes (optional)", singleLine = false, maxLines = 3)
    }
}

// ─── Capture Voice ─────────────────────────────────────────────

@Composable
fun CaptureVoiceStep(vm: OnboardingViewModel, onContinue: () -> Unit) {
    val prompts by vm.samplePrompts.collectAsState()
    val defaultPrompts = listOf(
        "Hey, are you free this week and how much would it be?",
        "Can you do sometime next week? Let me know what works.",
        "Quick one — do you cover my area?",
    )
    val displayPrompts = prompts.ifEmpty { defaultPrompts }
    val replies = remember { mutableStateOf(List(3) { "" }) }
    val scope = rememberCoroutineScope()

    OnboardingScaffold(
        variant = 3,
        footer = {
            RetroButton("Continue", onClick = {
                scope.launch {
                    vm.saveToneSamples(replies.value)
                    onContinue()
                }
            })
        },
    ) {
        Row(verticalAlignment = Alignment.Top) {
            OnboardingHeadline(eyebrow = "Step 3", title = "Reply like you", accentTitle = "really would",
                modifier = Modifier.weight(1f))
            Spacer(Modifier.width(8.dp))
            com.flynnai.app.ui.components.Mascot(MascotPose.Write, size = 76.dp)
        }
        Spacer(Modifier.height(8.dp))
        Text("These are messages someone might send you. Reply exactly how you'd text back.",
            style = FlynnTypography.bodyMedium.copy(color = OB.ink.copy(alpha = 0.65f)))
        Spacer(Modifier.height(20.dp))
        displayPrompts.forEachIndexed { i, prompt ->
            CustomerBubble(prompt)
            Spacer(Modifier.height(8.dp))
            RetroField(
                value = replies.value.getOrElse(i) { "" },
                onValueChange = { v -> replies.value = replies.value.toMutableList().also { it[i] = v } },
                placeholder = "type how you'd really reply…",
                singleLine = false,
                maxLines = 4,
            )
            if (i < displayPrompts.lastIndex) Spacer(Modifier.height(20.dp))
        }
    }
}

// ─── Sounds Like You (draft demo) ──────────────────────────────

@Composable
fun SoundsLikeYouStep(vm: OnboardingViewModel, onContinue: () -> Unit) {
    OnboardingScaffold(variant = 0, footer = { RetroButton("Sounds like me!", onContinue) }) {
        MascotHero(MascotPose.ThumbsUp)
        Spacer(Modifier.height(24.dp))
        OnboardingHeadline(eyebrow = "Step 4", title = "Sound like", accentTitle = "you?")
        Spacer(Modifier.height(12.dp))
        Text("Flynn drafted a reply in your style. Looks good? You're ready.",
            style = FlynnTypography.bodyLarge.copy(color = OB.ink.copy(alpha = 0.75f)))
        Spacer(Modifier.height(20.dp))
        DraftBubble("Yeah for sure, I can do Thursday arvo — does 2pm work for you?")
    }
}

// ─── Connect Calendar ──────────────────────────────────────────

@Composable
fun ConnectCalendarStep(onContinue: () -> Unit) {
    var calConnected by remember { mutableStateOf(false) }
    val context = LocalContext.current

    OnboardingScaffold(variant = 1, footer = { RetroButton("Continue", onContinue) }) {
        OnboardingHeadline(eyebrow = "Step 5", title = "Connect your", accentTitle = "calendar")
        Spacer(Modifier.height(8.dp))
        Text("So Flynn can offer times you're actually free, and add confirmed plans straight to your calendar.",
            style = FlynnTypography.bodyMedium.copy(color = OB.ink.copy(alpha = 0.65f)))
        Spacer(Modifier.height(24.dp))
        CalendarRow(
            icon = { Icon(Icons.Default.CalendarMonth, null, tint = OB.orange) },
            title = "Google Calendar",
            subtitle = if (calConnected) "Connected" else "On this device — one tap",
            connected = calConnected,
            onClick = {
                // Phase 11 will wire CalendarContract permission; open settings for now
                val i = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                context.startActivity(i)
            },
        )
        Spacer(Modifier.height(12.dp))
        CalendarRow(
            icon = { Icon(Icons.Default.Language, null, tint = OB.ink.copy(alpha = 0.3f)) },
            title = "Apple Calendar",
            subtitle = "Not available on Android",
            connected = false,
            enabled = false,
            onClick = {},
        )
    }
}

@Composable
private fun CalendarRow(
    icon: @Composable () -> Unit,
    title: String,
    subtitle: String,
    connected: Boolean,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(OB.outlineWidth.dp, OB.ink, RoundedCornerShape(14.dp))
            .background(OB.card)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(32.dp), contentAlignment = Alignment.Center) { icon() }
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = FlynnTypography.headlineSmall.copy(color = OB.ink))
            Text(subtitle, style = FlynnTypography.bodySmall.copy(color = OB.ink.copy(alpha = 0.5f)))
        }
        if (connected) Icon(Icons.Default.Check, null, tint = OB.teal)
        else Icon(Icons.Default.ChevronRight, null, tint = OB.ink.copy(alpha = 0.3f))
    }
}

// ─── Paywall ───────────────────────────────────────────────────

@Composable
fun PaywallStep(onContinue: () -> Unit) {
    OnboardingScaffold(variant = 2, footer = {
        Column {
            RetroButton("Start free — 20 drafts/day", onContinue)
            Spacer(Modifier.height(8.dp))
            RetroButton("Go unlimited (Pro)", onContinue, variant = RetroVariant.Secondary)
        }
    }) {
        MascotHero(MascotPose.Point)
        Spacer(Modifier.height(24.dp))
        OnboardingHeadline(title = "Unlock", accentTitle = "Flynn")
        Spacer(Modifier.height(16.dp))
        listOf("20 AI drafts/day free forever", "Pro = unlimited drafts", "Calendar booking included", "Cancel any time").forEach { feature ->
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                Icon(Icons.Default.Stars, null, tint = OB.orange, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(10.dp))
                Text(feature, style = FlynnTypography.bodyLarge.copy(color = OB.ink))
            }
        }
    }
}

// ─── Practice ──────────────────────────────────────────────────

@Composable
fun PracticeStep(vm: OnboardingViewModel, onContinue: () -> Unit) {
    OnboardingScaffold(variant = 3, footer = { RetroButton("I've tried it!", onContinue) }) {
        MascotHero(MascotPose.Point, size = 140.dp)
        Spacer(Modifier.height(20.dp))
        OnboardingHeadline(eyebrow = "Try it", title = "See it", accentTitle = "in action")
        Spacer(Modifier.height(12.dp))
        Text("Copy the message below, switch to the Flynn keyboard, and see your reply drafted instantly.",
            style = FlynnTypography.bodyLarge.copy(color = OB.ink.copy(alpha = 0.75f)))
        Spacer(Modifier.height(20.dp))
        CustomerBubble("Hey, are you free this week and how much would it cost?")
        Spacer(Modifier.height(12.dp))
        Text("Copy this, switch to the Flynn keyboard, and tap ↻ Redraft",
            style = FlynnTypography.bodySmall.copy(color = OB.orange), textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth())
    }
}

// ─── Install Keyboard ──────────────────────────────────────────

@Composable
fun InstallKeyboardStep(onFinish: () -> Unit) {
    val context = LocalContext.current
    OnboardingScaffold(variant = 2, footer = {
        Column {
            RetroButton("Open keyboard settings", onClick = {
                context.startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
            })
            Spacer(Modifier.height(8.dp))
            RetroButton("I've added it — finish", onFinish, variant = RetroVariant.Secondary)
        }
    }) {
        Row(verticalAlignment = Alignment.Top) {
            OnboardingHeadline(eyebrow = "Last step", title = "Add the", accentTitle = "Flynn keyboard",
                modifier = Modifier.weight(1f))
            Spacer(Modifier.width(8.dp))
            com.flynnai.app.ui.components.Mascot(MascotPose.Phone, size = 80.dp)
        }
        Spacer(Modifier.height(8.dp))
        Text("This is how Flynn drafts replies right inside any messaging app.",
            style = FlynnTypography.bodyMedium.copy(color = OB.ink.copy(alpha = 0.65f)))
        Spacer(Modifier.height(24.dp))
        listOf(
            "Open Settings → Languages & input → On-screen keyboard.",
            "Tap \"Manage on-screen keyboards\" and enable Flynn.",
            "In any text field, tap the keyboard icon and switch to Flynn.",
        ).forEachIndexed { i, text ->
            InstructionRow("${i + 1}", text)
            if (i < 2) Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun InstructionRow(number: String, text: String) {
    Row(verticalAlignment = Alignment.Top) {
        Box(
            modifier = Modifier
                .size(30.dp)
                .clip(CircleShape)
                .background(OB.orange)
                .border(OB.outlineWidth.dp, OB.ink, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(number, style = FlynnTypography.labelLarge.copy(color = Color.White))
        }
        Spacer(Modifier.width(14.dp))
        Text(text, style = FlynnTypography.bodyMedium.copy(color = OB.ink), modifier = Modifier.weight(1f))
    }
}

// ─── Shared bubbles ────────────────────────────────────────────

@Composable
fun CustomerBubble(text: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(OB.outlineWidth.dp, OB.ink, RoundedCornerShape(14.dp))
            .background(OB.card)
            .padding(14.dp),
    ) { Text(text, style = FlynnTypography.bodyMedium.copy(color = OB.ink)) }
}

@Composable
fun DraftBubble(text: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(OB.outlineWidth.dp, OB.ink, RoundedCornerShape(14.dp))
            .background(OB.mustard.copy(alpha = 0.28f))
            .padding(14.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(Icons.Default.Stars, null, tint = OB.orange, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(10.dp))
        Text(text, style = FlynnTypography.bodyMedium.copy(color = OB.ink), modifier = Modifier.weight(1f))
    }
}
