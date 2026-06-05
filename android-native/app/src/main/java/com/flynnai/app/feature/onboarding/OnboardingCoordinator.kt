package com.flynnai.app.feature.onboarding

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun OnboardingCoordinator(
    vm: OnboardingViewModel = viewModel(),
    onFinished: () -> Unit,
) {
    val step by vm.step.collectAsState()
    val advancing by vm.advancing.collectAsState()
    val context = LocalContext.current

    AnimatedContent(
        targetState = step,
        transitionSpec = {
            if (advancing) {
                slideInHorizontally { it } togetherWith slideOutHorizontally { -it }
            } else {
                slideInHorizontally { -it } togetherWith slideOutHorizontally { it }
            }
        },
        label = "onboardingStep",
    ) { s ->
        when (s) {
            OnboardingStep.Welcome -> WelcomeStep(onContinue = { vm.advance() })
            OnboardingStep.WhatYouDo -> WhatYouDoStep(vm = vm, onContinue = { vm.advance() })
            OnboardingStep.ConfirmBrain -> ConfirmBrainStep(vm = vm, onContinue = { vm.advance() })
            OnboardingStep.CaptureVoice -> CaptureVoiceStep(vm = vm, onContinue = { vm.advance() })
            OnboardingStep.SoundsLikeYou -> SoundsLikeYouStep(vm = vm, onContinue = { vm.advance() })
            OnboardingStep.ConnectCalendar -> ConnectCalendarStep(onContinue = { vm.advance() })
            OnboardingStep.Paywall -> PaywallStep(onContinue = { vm.advance() })
            OnboardingStep.Practice -> PracticeStep(vm = vm, onContinue = { vm.advance() })
            OnboardingStep.InstallKeyboard -> InstallKeyboardStep(onFinish = {
                vm.markOnboardingComplete(context)
                onFinished()
            })
        }
    }
}
