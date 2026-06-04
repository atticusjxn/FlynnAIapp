package com.flynnai.app.ui.onboarding.ob

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.flynnai.app.ui.theme.FlynnTypography
import com.flynnai.app.ui.theme.Spacing

enum class RetroVariant { Primary, Secondary }

@Composable
fun RetroButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: RetroVariant = RetroVariant.Primary,
    isLoading: Boolean = false,
    enabled: Boolean = true,
) {
    val bg = if (variant == RetroVariant.Primary) OB.orange else OB.card
    val fg = if (variant == RetroVariant.Primary) Color.White else OB.ink
    val shape = RoundedCornerShape(12.dp)

    // Shadow layer
    Box(modifier = modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .offset(x = 3.dp, y = 3.dp)
                .clip(shape)
                .background(OB.ink),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(shape)
                .border(OB.outlineWidth.dp, OB.ink, shape)
                .background(if (enabled) bg else OB.card)
                .then(
                    if (enabled && !isLoading)
                        Modifier.clickable(role = Role.Button) { onClick() }
                    else Modifier
                )
                .padding(vertical = Spacing.md),
            contentAlignment = Alignment.Center,
        ) {
            if (isLoading) {
                CircularProgressIndicator(color = fg, strokeWidth = 2.dp)
            } else {
                Text(
                    text = title,
                    style = FlynnTypography.headlineSmall,
                    color = if (enabled) fg else OB.ink.copy(alpha = 0.4f),
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}
