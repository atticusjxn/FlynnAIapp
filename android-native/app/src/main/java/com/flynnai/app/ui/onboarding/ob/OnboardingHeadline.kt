package com.flynnai.app.ui.onboarding.ob

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.flynnai.app.ui.theme.FlynnTypography

@Composable
fun OnboardingHeadline(
    title: String,
    modifier: Modifier = Modifier,
    eyebrow: String? = null,
    accentTitle: String? = null,
) {
    Column(modifier = modifier) {
        if (eyebrow != null) {
            Text(
                text = eyebrow.uppercase(),
                style = FlynnTypography.labelMedium,
                color = OB.orange,
                modifier = Modifier.padding(bottom = 6.dp),
            )
        }
        if (accentTitle != null) {
            Text(
                text = buildAnnotatedString {
                    append("$title ")
                    withStyle(SpanStyle(color = OB.orange)) { append(accentTitle) }
                },
                style = FlynnTypography.displayLarge.copy(color = OB.ink),
            )
        } else {
            Text(
                text = title,
                style = FlynnTypography.displayLarge.copy(color = OB.ink),
            )
        }
    }
}
