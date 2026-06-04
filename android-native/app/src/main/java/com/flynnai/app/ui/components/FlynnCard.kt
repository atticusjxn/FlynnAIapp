package com.flynnai.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.flynnai.app.ui.theme.FlynnCard
import com.flynnai.app.ui.theme.Spacing
import com.flynnai.app.ui.theme.brutalistBorder
import com.flynnai.app.ui.theme.brutalistShadow

@Composable
fun FlynnCard(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .brutalistShadow()
            .brutalistBorder()
            .background(FlynnCard)
            .padding(Spacing.md),
        content = content,
    )
}
