package com.flynnai.app.billing

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Stars
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import kotlinx.coroutines.launch
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.android.billingclient.api.ProductDetails
import com.flynnai.app.ui.components.MascotPose
import com.flynnai.app.ui.onboarding.ob.MascotHero
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.onboarding.ob.RetroButton
import com.flynnai.app.ui.onboarding.ob.RetroVariant
import com.flynnai.app.ui.theme.FlynnOrange
import com.flynnai.app.ui.theme.FlynnTextSecondary
import com.flynnai.app.ui.theme.FlynnTypography

@Composable
fun PaywallScreen(
    billingManager: BillingManager,
    onDismiss: () -> Unit = {},
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val purchaseState by billingManager.purchaseState.collectAsState()
    var products by remember { mutableStateOf<List<ProductDetails>>(emptyList()) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        billingManager.connect { ready ->
            if (ready) scope.launch { products = billingManager.loadProducts() }
        }
    }

    if (purchaseState is PurchaseState.Success) {
        LaunchedEffect(Unit) { onDismiss() }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(OB.cream)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
    ) {
        MascotHero(MascotPose.ThumbsUp)
        Spacer(Modifier.height(20.dp))

        Text("Unlock", style = FlynnTypography.displayLarge)
        Text("Flynn Pro", style = FlynnTypography.displayLarge.copy(color = OB.orange))
        Spacer(Modifier.height(16.dp))

        listOf(
            "Unlimited AI drafts every day",
            "Calendar booking & availability",
            "Tone learning from your replies",
            "Cancel any time",
        ).forEach { feature ->
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 5.dp)) {
                Icon(Icons.Default.Stars, null, tint = FlynnOrange, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(10.dp))
                Text(feature, style = FlynnTypography.bodyLarge)
            }
        }

        Spacer(Modifier.height(32.dp))

        // Plan options
        if (products.isNotEmpty()) {
            products.forEach { product ->
                val offer = product.subscriptionOfferDetails?.firstOrNull()
                val price = offer?.pricingPhases?.pricingPhaseList?.lastOrNull()?.formattedPrice ?: "—"
                val isMonthly = product.productId == PRODUCT_PRO_MONTHLY
                PlanCard(
                    title = if (isMonthly) "Monthly" else "Annual",
                    price = price,
                    subtitle = if (!isMonthly) "Best value — 2 months free" else null,
                    onClick = { activity?.let { billingManager.launchPurchase(it, product.productId) } },
                    isLoading = purchaseState is PurchaseState.Purchasing,
                )
                Spacer(Modifier.height(12.dp))
            }
        } else {
            // Fallback when not connected to Play Store (emulator / dev)
            RetroButton(
                "Start free trial — Pro",
                onClick = {},
                isLoading = false,
            )
            Spacer(Modifier.height(8.dp))
        }

        RetroButton("Continue with free (20 drafts/day)", onDismiss, variant = RetroVariant.Secondary)

        if (purchaseState is PurchaseState.Failed) {
            Spacer(Modifier.height(12.dp))
            Text((purchaseState as PurchaseState.Failed).msg,
                style = FlynnTypography.bodySmall, color = OB.terra)
        }

        Spacer(Modifier.height(16.dp))
        Text("Payment processed by Google Play. Cancel any time in Play Store → Subscriptions.",
            style = FlynnTypography.bodySmall, color = FlynnTextSecondary)
    }
}

@Composable
private fun PlanCard(
    title: String,
    price: String,
    subtitle: String?,
    onClick: () -> Unit,
    isLoading: Boolean,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(2.dp, OB.ink, RoundedCornerShape(12.dp))
            .background(OB.card)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = FlynnTypography.titleLarge)
                if (subtitle != null) Text(subtitle, style = FlynnTypography.bodySmall, color = FlynnOrange)
            }
            Text(price, style = FlynnTypography.headlineMedium, color = FlynnOrange)
        }
        Spacer(Modifier.height(12.dp))
        RetroButton("Choose $title", onClick = onClick, isLoading = isLoading)
    }
}
