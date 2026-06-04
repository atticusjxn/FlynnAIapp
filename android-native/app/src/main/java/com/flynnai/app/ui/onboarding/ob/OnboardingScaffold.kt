package com.flynnai.app.ui.onboarding.ob

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// Mirrors iOS OnboardingScaffold:
//  - Cream background with mid-century backdrop
//  - Scrollable content area that dismisses keyboard on scroll (imePadding)
//  - Fixed footer pinned above keyboard via imePadding
@Composable
fun OnboardingScaffold(
    modifier: Modifier = Modifier,
    variant: Int = 0,
    footer: @Composable () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(OB.cream),
    ) {
        // Decorative backdrop (behind content)
        MidCenturyBackdrop(variant = variant)

        // Scrollable content + IME-aware footer
        Column(
            modifier = Modifier
                .fillMaxSize()
                .imePadding(),
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 28.dp, vertical = 48.dp),
                content = content,
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(OB.cream)
                    .padding(horizontal = 28.dp, vertical = 16.dp),
                contentAlignment = Alignment.Center,
            ) {
                footer()
            }
        }
    }
}
