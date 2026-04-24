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
                    case .websiteScrape:
                        WebsiteScrapeStepView(onContinue: advance)
                    case .mode:
                        CallHandlingModeStepView(onContinue: advance)
                    case .ivr:
                        IvrScriptStepView(onContinue: advance)
                    case .liveDemo:
                        LiveVoiceDemoStepView(store: store, onContinue: advance)
                    case .paywall:
                        PaywallStepView(
                            onSubscribe: advance,
                            onSkip: {
                                Task {
                                    await store.setSmsLinksMode()
                                    advance()
                                }
                            }
                        )
                    case .phoneNumber:
                        PhoneNumberStepView(store: store, onFinish: finish)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .animation(.spring(response: 0.45, dampingFraction: 0.85), value: store.currentStep)
            }
            .background(FlynnColor.background)
            .toolbar {
                if store.currentStep != .websiteScrape {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Back") { store.back() }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if store.currentStep != .phoneNumber && store.currentStep != .liveDemo {
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
            flash.success("You're set up — welcome to Flynn")
        }
    }
}
