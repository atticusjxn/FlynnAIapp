package com.flynnai.app.ui.onboarding.ob

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// Mirrors iOS MidCenturyBackdrop: geometric shapes hug top-right + bottom edges
// The top-left text zone stays clear cream.
@Composable
fun MidCenturyBackdrop(variant: Int = 0, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.fillMaxSize()) {
        when (variant % 4) {
            0 -> drawVariant0()
            1 -> drawVariant1()
            2 -> drawVariant2()
            else -> drawVariant3()
        }
    }
}

private fun DrawScope.drawVariant0() {
    // Top-right: large arc
    drawArc(
        color = OB.mustard.copy(alpha = 0.55f),
        startAngle = 90f, sweepAngle = 270f, useCenter = true,
        topLeft = Offset(size.width * 0.55f, -size.height * 0.15f),
        size = Size(size.width * 0.7f, size.height * 0.4f),
    )
    // Bottom-left: circle
    drawCircle(
        color = OB.teal.copy(alpha = 0.4f),
        radius = size.width * 0.3f,
        center = Offset(size.width * 0.1f, size.height * 0.92f),
    )
    // Bottom-right: arch
    drawArc(
        color = OB.terra.copy(alpha = 0.35f),
        startAngle = 180f, sweepAngle = 180f, useCenter = false,
        topLeft = Offset(size.width * 0.65f, size.height * 0.78f),
        size = Size(size.width * 0.5f, size.height * 0.28f),
    )
}

private fun DrawScope.drawVariant1() {
    // Top-right: tall pill
    val pillW = size.width * 0.28f
    val pillH = size.height * 0.38f
    drawRect(
        color = OB.teal.copy(alpha = 0.45f),
        topLeft = Offset(size.width - pillW * 0.6f, -pillH * 0.2f),
        size = Size(pillW, pillH),
    )
    // Bottom: starburst lines
    val cx = size.width * 0.5f; val cy = size.height * 1.05f
    for (i in 0 until 8) {
        val angle = (i * 45f) * (PI / 180f).toFloat()
        drawLine(
            color = OB.mustard.copy(alpha = 0.35f),
            start = Offset(cx, cy),
            end = Offset(cx + cos(angle) * size.width * 0.55f, cy + sin(angle) * size.height * 0.4f),
            strokeWidth = 14f,
        )
    }
}

private fun DrawScope.drawVariant2() {
    // Top-right: triangle
    val path = Path().apply {
        moveTo(size.width, 0f)
        lineTo(size.width, size.height * 0.38f)
        lineTo(size.width * 0.55f, 0f)
        close()
    }
    drawPath(path, OB.olive.copy(alpha = 0.45f))
    // Bottom: half circle
    drawArc(
        color = OB.terra.copy(alpha = 0.4f),
        startAngle = 0f, sweepAngle = 180f, useCenter = true,
        topLeft = Offset(size.width * 0.15f, size.height * 0.82f),
        size = Size(size.width * 0.65f, size.height * 0.35f),
    )
}

private fun DrawScope.drawVariant3() {
    // Top-right: rotated rect
    rotate(15f, Offset(size.width, 0f)) {
        drawRect(
            color = OB.mustard.copy(alpha = 0.5f),
            topLeft = Offset(size.width * 0.5f, -size.height * 0.05f),
            size = Size(size.width * 0.6f, size.height * 0.35f),
        )
    }
    // Bottom-left: circle cluster
    drawCircle(OB.teal.copy(alpha = 0.35f), size.width * 0.2f, Offset(0f, size.height))
    drawCircle(OB.orange.copy(alpha = 0.25f), size.width * 0.12f, Offset(size.width * 0.22f, size.height * 0.95f))
}

private val Color.Companion.Unspecified get() = Color(0, 0, 0, 0)
