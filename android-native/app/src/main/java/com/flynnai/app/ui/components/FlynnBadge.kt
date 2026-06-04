package com.flynnai.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.flynnai.app.ui.theme.*

enum class FlynnBadgeVariant(val bg: Color, val fg: Color) {
    Orange(FlynnOrange, Color.White),
    Mustard(FlynnMustard, FlynnInk),
    Teal(FlynnTeal, Color.White),
    Cream(FlynnCream, FlynnInk),
}

@Composable
fun FlynnBadge(
    text: String,
    variant: FlynnBadgeVariant = FlynnBadgeVariant.Orange,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        style = FlynnTypography.labelSmall,
        color = variant.fg,
        modifier = modifier
            .clip(RoundedCornerShape(99.dp))
            .background(variant.bg)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}
