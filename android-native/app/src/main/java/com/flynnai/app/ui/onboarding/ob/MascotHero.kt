package com.flynnai.app.ui.onboarding.ob

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.flynnai.app.ui.components.Mascot
import com.flynnai.app.ui.components.MascotPose

// Spring entrance animation — transparent mascot floats in from below
@Composable
fun MascotHero(
    pose: MascotPose,
    size: Dp = 180.dp,
    modifier: Modifier = Modifier,
) {
    var visible by remember { mutableStateOf(false) }
    val offsetY by animateFloatAsState(
        targetValue = if (visible) 0f else 60f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow,
        ),
        label = "mascotY",
    )
    val alpha by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label = "mascotAlpha",
    )

    LaunchedEffect(Unit) { visible = true }

    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center,
    ) {
        Mascot(
            pose = pose,
            size = size,
            modifier = Modifier
                .size(size)
                .graphicsLayer { translationY = offsetY; this.alpha = alpha },
        )
    }
}
