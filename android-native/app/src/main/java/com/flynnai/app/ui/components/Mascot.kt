package com.flynnai.app.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.flynnai.app.R

enum class MascotPose(@DrawableRes val resId: Int) {
    Wave(R.drawable.mascot_wave),
    ThumbsUp(R.drawable.mascot_thumbsup),
    Thinking(R.drawable.mascot_thinking),
    Point(R.drawable.mascot_point),
    Peek(R.drawable.mascot_peek),
    Write(R.drawable.mascot_write),
    Sleep(R.drawable.mascot_sleep),
    Phone(R.drawable.mascot_phone),
}

@Composable
fun Mascot(
    pose: MascotPose,
    size: Dp = 120.dp,
    modifier: Modifier = Modifier,
) {
    Image(
        painter = painterResource(pose.resId),
        contentDescription = null,
        contentScale = ContentScale.Fit,
        modifier = modifier.size(size),
    )
}
