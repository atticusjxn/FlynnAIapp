package com.flynnai.app.feature.voice

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.theme.FlynnTypography

@Composable
fun VoiceScreen() {
    Box(Modifier.fillMaxSize().background(OB.cream), contentAlignment = Alignment.Center) {
        Text("Voice", style = FlynnTypography.displayLarge)
    }
}
