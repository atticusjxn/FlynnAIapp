package com.flynnai.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
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
import com.flynnai.app.ui.theme.*

enum class FlynnButtonVariant { Primary, Secondary, Danger }

@Composable
fun FlynnButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: FlynnButtonVariant = FlynnButtonVariant.Primary,
    isLoading: Boolean = false,
    enabled: Boolean = true,
) {
    val bg = when {
        !enabled -> FlynnBorder
        variant == FlynnButtonVariant.Primary -> FlynnOrange
        variant == FlynnButtonVariant.Danger -> Color(0xFFEF4444)
        else -> FlynnCard
    }
    val fg = when {
        !enabled -> FlynnTextTertiary
        variant == FlynnButtonVariant.Primary || variant == FlynnButtonVariant.Danger -> Color.White
        else -> FlynnInk
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .brutalistShadow()
            .brutalistBorder()
            .background(bg)
            .then(if (enabled && !isLoading) Modifier.clickable(role = Role.Button) { onClick() } else Modifier)
            .padding(PaddingValues(horizontal = Spacing.lg, vertical = Spacing.md)),
        contentAlignment = Alignment.Center,
    ) {
        if (isLoading) {
            CircularProgressIndicator(color = fg, strokeWidth = 2.dp, modifier = Modifier.padding(4.dp))
        } else {
            Text(
                text = title,
                style = FlynnTypography.titleLarge,
                color = fg,
                textAlign = TextAlign.Center,
            )
        }
    }
}
