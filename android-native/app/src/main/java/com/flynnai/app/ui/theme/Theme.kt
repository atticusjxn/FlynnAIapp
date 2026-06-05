package com.flynnai.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val FlynnColorScheme = lightColorScheme(
    primary = FlynnOrange,
    onPrimary = FlynnOnPrimary,
    background = FlynnBackground,
    surface = FlynnSurface,
    onSurface = FlynnOnSurface,
    onBackground = FlynnInk,
    outline = FlynnBorder,
)

@Composable
fun FlynnTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = FlynnColorScheme,
        typography = FlynnTypography,
        content = content,
    )
}
