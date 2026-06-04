package com.flynnai.app.nav

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.flynnai.app.FlynnApp
import com.flynnai.app.feature.auth.AuthViewModel
import com.flynnai.app.feature.auth.LoginScreen
import com.flynnai.app.feature.onboarding.OnboardingCoordinator
import com.flynnai.app.ui.onboarding.ob.DesignGalleryScreen
import com.flynnai.app.ui.onboarding.ob.OB
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

@Composable
fun FlynnNavHost(authVm: AuthViewModel = viewModel()) {
    val sessionStatus by authVm.sessionStatus.collectAsState()

    when (sessionStatus) {
        is SessionStatus.Initializing -> {
            Box(Modifier.fillMaxSize().background(OB.cream))
        }
        is SessionStatus.NotAuthenticated, is SessionStatus.RefreshFailure -> {
            LoginScreen(vm = authVm)
        }
        is SessionStatus.Authenticated -> {
            AuthenticatedRoot()
        }
    }
}

@Composable
private fun AuthenticatedRoot() {
    var onboardingDone by remember { mutableStateOf<Boolean?>(null) }

    LaunchedEffect(Unit) {
        onboardingDone = try {
            val client = FlynnApp.instance.supabase
            val session = client.auth.currentSessionOrNull() ?: return@LaunchedEffect
            @Serializable data class Row(val onboarding_completed: Boolean)
            val row: Row = withContext(Dispatchers.IO) {
                client.postgrest.from("users")
                    .select { filter { eq("id", session.user?.id?.toString() ?: "") } }
                    .decodeSingle()
            }
            row.onboarding_completed
        } catch (_: Exception) { false }
    }

    when (onboardingDone) {
        null -> Box(Modifier.fillMaxSize().background(OB.cream)) // loading
        false -> OnboardingCoordinator(onFinished = { onboardingDone = true })
        true -> MainTabView()
    }
}
