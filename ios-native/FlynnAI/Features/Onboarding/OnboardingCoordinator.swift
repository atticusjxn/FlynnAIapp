import SwiftUI

/// Routes between the onboarding steps on the shared cream surface. Renders its own
/// top bar (back + progress + skip) so the chrome matches the mid-century look, and
/// slides steps directionally (forward → in from the right).
struct OnboardingCoordinator: View {
    @Environment(FlashStore.self) private var flash
    @Bindable var store: OnboardingStore

    private let skippable: [OnboardingStore.Step] = [.confirmBrain, .connectCalendar, .paywall, .practice]

    var body: some View {
        NavigationStack {
            ZStack {
                OB.cream.ignoresSafeArea()
                VStack(spacing: 0) {
                    topBar
                    stepContent
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationBarHidden(true)
            .keyboardDoneToolbar()
        }
        .environment(\.colorScheme, .light)
        .tint(OB.orange)
    }

    // MARK: Top bar

    private var topBar: some View {
        HStack(spacing: 12) {
            if store.currentStep != .welcome {
                Button { store.back() } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 17, weight: .bold))
                        .foregroundColor(OB.ink)
                        .frame(width: 34, height: 34)
                        .background(Circle().fill(OB.card))
                        .overlay(Circle().stroke(OB.ink, lineWidth: OB.outline))
                }
                .buttonStyle(.plain)
            } else {
                Color.clear.frame(width: 34, height: 34)
            }

            progressDots

            if skippable.contains(store.currentStep) {
                Button("Skip") { store.advance() }
                    .font(.custom(FlynnFontName.interMedium, size: 14))
                    .foregroundColor(OB.inkFaint)
                    .frame(minWidth: 34, alignment: .trailing)
            } else {
                Color.clear.frame(width: 34, height: 34)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 10)
    }

    private var progressDots: some View {
        HStack(spacing: 6) {
            ForEach(OnboardingStore.Step.allCases) { step in
                Capsule()
                    .fill(step.rawValue <= store.currentStep.rawValue ? OB.orange : OB.ink.opacity(0.18))
                    .frame(height: 6)
                    .overlay(
                        step.rawValue == store.currentStep.rawValue
                        ? Capsule().stroke(OB.ink, lineWidth: 1.5) : nil
                    )
            }
        }
        .frame(maxWidth: .infinity)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: store.currentStep)
    }

    // MARK: Steps

    @ViewBuilder
    private var stepContent: some View {
        Group {
            switch store.currentStep {
            case .welcome:
                WelcomeStepView(onContinue: store.advance)
            case .whatYouDo:
                WhatYouDoStepView(store: store, onContinue: store.advance)
            case .confirmBrain:
                ConfirmBrainStepView(store: store, onContinue: store.advance)
            case .captureVoice:
                CaptureVoiceStepView(store: store, onContinue: store.advance)
            case .soundsLikeYou:
                SoundsLikeYouStepView(store: store, onContinue: store.advance)
            case .connectCalendar:
                ConnectCalendarStepView(onContinue: store.advance)
            case .paywall:
                PaywallStepView(store: store, onSubscribe: store.advance, onSkip: store.advance)
            case .practice:
                PracticeStepView(onContinue: store.advance)
            case .installKeyboard:
                InstallKeyboardStepView(onFinish: finish)
            }
        }
        .id(store.currentStep)
        .transition(.asymmetric(
            insertion: .move(edge: store.advancing ? .trailing : .leading).combined(with: .opacity),
            removal: .move(edge: store.advancing ? .leading : .trailing).combined(with: .opacity)
        ))
        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: store.currentStep)
    }

    private func finish() {
        Task {
            await store.markComplete()
            await KeyboardBridge.sync(businessName: store.detectedBusinessType.isEmpty ? nil : store.detectedBusinessType)
            flash.success("You're set up — welcome to Flynn")
        }
    }
}
