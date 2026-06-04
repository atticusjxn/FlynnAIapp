package com.flynnai.app.feature.brain

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flynnai.app.ui.components.FlynnTextField
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.onboarding.ob.RetroButton
import com.flynnai.app.ui.theme.FlynnOrange
import com.flynnai.app.ui.theme.FlynnTextSecondary
import com.flynnai.app.ui.theme.FlynnTypography

@Composable
fun BrainScreen(vm: BrainViewModel = viewModel()) {
    val businessType by vm.businessType.collectAsState()
    val businessDesc by vm.businessDescription.collectAsState()
    val services by vm.services.collectAsState()
    val pricingNotes by vm.pricingNotes.collectAsState()
    val serviceArea by vm.serviceArea.collectAsState()
    val websiteURL by vm.websiteURL.collectAsState()
    val saving by vm.saving.collectAsState()
    val rescanning by vm.rescanning.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(OB.cream)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            Text("Brain", style = FlynnTypography.displayMedium)
            RetroButton("Save", onClick = { vm.save {} }, isLoading = saving,
                modifier = Modifier.padding(start = 12.dp))
        }
        Text("Flynn uses this when drafting your replies.", style = FlynnTypography.bodyMedium,
            color = FlynnTextSecondary)
        Spacer(Modifier.height(24.dp))

        SectionLabel("Your business")
        FlynnTextField(businessType, { vm.businessType.value = it }, "What you do (e.g. plumber)")
        Spacer(Modifier.height(10.dp))
        FlynnTextField(businessDesc, { vm.businessDescription.value = it },
            "Short description", singleLine = false)

        Spacer(Modifier.height(20.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            SectionLabel("Services & pricing")
            IconButton(onClick = {
                vm.services.value = services + BrainService(name = "", priceRange = "")
            }) { Icon(Icons.Default.Add, null, tint = FlynnOrange) }
        }
        services.forEachIndexed { i, svc ->
            Spacer(Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically) {
                FlynnTextField(svc.name, { v ->
                    vm.services.value = services.toMutableList().also { it[i] = svc.copy(name = v) }
                }, "Service", modifier = Modifier.weight(1f))
                FlynnTextField(svc.priceRange, { v ->
                    vm.services.value = services.toMutableList().also { it[i] = svc.copy(priceRange = v) }
                }, "Price", modifier = Modifier.weight(0.6f),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
                IconButton(onClick = {
                    vm.services.value = services.toMutableList().also { it.removeAt(i) }
                }) { Icon(Icons.Default.Delete, null, tint = FlynnTextSecondary) }
            }
        }

        Spacer(Modifier.height(20.dp))
        SectionLabel("Pricing notes")
        FlynnTextField(pricingNotes, { vm.pricingNotes.value = it },
            "e.g. \$90 callout, quotes free", singleLine = false)

        Spacer(Modifier.height(20.dp))
        SectionLabel("Service area")
        FlynnTextField(serviceArea, { vm.serviceArea.value = it },
            "e.g. Northern Beaches, North Shore")

        Spacer(Modifier.height(20.dp))
        SectionLabel("Website")
        FlynnTextField(websiteURL, { vm.websiteURL.value = it }, "https://yourbusiness.com",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
        Spacer(Modifier.height(8.dp))
        TextButton(
            onClick = { vm.rescan() },
            enabled = websiteURL.isNotBlank() && !rescanning,
        ) {
            if (rescanning) {
                CircularProgressIndicator(strokeWidth = 2.dp, color = FlynnOrange,
                    modifier = Modifier.padding(end = 6.dp))
            } else {
                Icon(Icons.Default.Refresh, null, tint = FlynnOrange,
                    modifier = Modifier.padding(end = 6.dp))
            }
            Text("Re-scan my website", color = FlynnOrange)
        }
        Text("Flynn pulls services, pricing and hours from your website.",
            style = FlynnTypography.bodySmall, color = FlynnTextSecondary)

        Spacer(Modifier.height(40.dp))
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, style = FlynnTypography.labelLarge, color = FlynnTextSecondary,
        modifier = Modifier.padding(bottom = 6.dp))
}
