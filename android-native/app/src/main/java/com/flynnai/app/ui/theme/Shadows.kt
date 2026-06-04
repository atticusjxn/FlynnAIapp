package com.flynnai.app.ui.theme

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// Brutalist offset-rect shadow — mirrors iOS's .brutalistShadow() modifier
fun Modifier.brutalistShadow(
    offsetX: Dp = 3.dp,
    offsetY: Dp = 3.dp,
    color: Color = FlynnInk,
) = this.drawBehind {
    val offsetXPx = offsetX.toPx()
    val offsetYPx = offsetY.toPx()
    drawRect(
        color = color,
        topLeft = Offset(offsetXPx, offsetYPx),
        size = size,
    )
}

fun Modifier.brutalistBorder(
    width: Dp = 2.dp,
    color: Color = FlynnInk,
) = this.drawBehind {
    val strokeW = width.toPx()
    val half = strokeW / 2f
    drawRect(
        color = color,
        topLeft = Offset(half, half),
        size = androidx.compose.ui.geometry.Size(size.width - strokeW, size.height - strokeW),
        style = androidx.compose.ui.graphics.drawscope.Stroke(strokeW),
    )
}
