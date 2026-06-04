package com.flynnai.app.ui.onboarding.ob

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.flynnai.app.ui.components.MascotPose
import com.flynnai.app.ui.theme.FlynnTypography

// Temporary gallery screen used to eyeball the Phase 2 design system.
// Will be replaced by real onboarding steps in Phase 6.
@Composable
fun DesignGalleryScreen() {
    var text by remember { mutableStateOf("") }
    OnboardingScaffold(
        variant = 0,
        footer = {
            RetroButton(title = "Continue", onClick = {})
        },
    ) {
        MascotHero(pose = MascotPose.Wave)
        Spacer(Modifier.height(20.dp))
        OnboardingHeadline(
            eyebrow = "Design system",
            title = "Reply in",
            accentTitle = "your voice.",
        )
        Spacer(Modifier.height(20.dp))
        Text(
            text = "Flynn learns how you write and drafts replies that sound like you.",
            style = FlynnTypography.bodyLarge.copy(color = OB.ink.copy(alpha = 0.75f)),
        )
        Spacer(Modifier.height(24.dp))
        RetroField(
            value = text,
            onValueChange = { text = it },
            placeholder = "Your business name",
        )
        Spacer(Modifier.height(12.dp))
        RetroButton(title = "Secondary", onClick = {}, variant = RetroVariant.Secondary)
    }
}
