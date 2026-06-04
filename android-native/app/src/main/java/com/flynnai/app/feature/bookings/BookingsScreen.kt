package com.flynnai.app.feature.bookings

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
fun BookingsScreen() {
    Box(Modifier.fillMaxSize().background(OB.cream), contentAlignment = Alignment.Center) {
        Text("Bookings", style = FlynnTypography.displayLarge)
    }
}
