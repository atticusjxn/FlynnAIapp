import SwiftUI

/// Routes between the 6 onboarding steps. Each step reuses existing
/// feature views or new dedicated step views, all sharing code with settings.
struct OnboardingCoordinator: View {
    @Environment(FlashStore.self) private var flash
    @Bindable var store: OnboardingStore

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                progress
                Divider()

                Group {
                    switch store.currentStep {
                    case .welcome:
                        WelcomeStepView(onContinue: advance)
                    case .whatYouDo:
                        WhatYouDoStepView(store: store, onContinue: advance)
                    case .confirmBrain:
                        ConfirmBrainStepView(store: store, onContinue: advance)
                    case .captureVoice:
                        CaptureVoiceStepView(store: store, onContinue: advance)
                    case .soundsLikeYou:
                        SoundsLikeYouStepView(store: store, onContinue: advance)
                    case .connectCalendar:
                        ConnectCalendarStepView(onContinue: advance)
                    case .paywall:
                        PaywallStepView(
                            store: store,
                            onSubscribe: advance,
                            onSkip: advance
                        )
                    case .practice:
                        PracticeStepView(onContinue: advance)
                    case .installKeyboard:
                        InstallKeyboardStepView(onFinish: finish)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .animation(.spring(response: 0.45, dampingFraction: 0.85), value: store.currentStep)
            }
            .background(FlynnColor.background)
            .toolbar {
                if store.currentStep != .welcome {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Back") { store.back() }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    let skippable: [OnboardingStore.Step] = [.confirmBrain, .connectCalendar, .paywall, .practice]
                    if skippable.contains(store.currentStep) {
                        Button("Skip") { advance() }
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                }
            }
        }
    }

    private var progress: some View {
        HStack(spacing: FlynnSpacing.xs) {
            ForEach(OnboardingStore.Step.allCases) { step in
                Capsule()
                    .fill(step.rawValue <= store.currentStep.rawValue
                          ? FlynnColor.primary
                          : FlynnColor.gray300)
                    .frame(height: 6)
            }
        }
        .padding(.horizontal, FlynnSpacing.lg)
        .padding(.vertical, FlynnSpacing.sm)
    }

    private func advance() {
        store.advance()
    }

    private func finish() {
        Task {
            await store.markComplete()
            // Make sure the keyboard has a fresh token + business name to work with.
            await KeyboardBridge.sync(businessName: store.detectedBusinessType.isEmpty ? nil : store.detectedBusinessType)
            flash.success("You're set up — welcome to Flynn")
        }
    }
}
