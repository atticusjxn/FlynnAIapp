package com.flynnai.app.ui.onboarding.ob

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.flynnai.app.ui.theme.FlynnTypography

@Composable
fun RetroField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String = "",
    modifier: Modifier = Modifier,
    singleLine: Boolean = true,
    maxLines: Int = if (singleLine) 1 else 4,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
) {
    val shape = RoundedCornerShape(10.dp)
    TextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = {
            Text(placeholder, style = FlynnTypography.bodyLarge, color = OB.ink.copy(alpha = 0.4f))
        },
        singleLine = singleLine,
        maxLines = maxLines,
        keyboardOptions = keyboardOptions,
        textStyle = FlynnTypography.bodyLarge.copy(color = OB.ink),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = OB.card,
            unfocusedContainerColor = OB.card,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
        ),
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .border(OB.outlineWidth.dp, OB.ink, shape)
            .background(OB.card),
    )
}
