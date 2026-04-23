import SwiftUI

/// Routes between the 5 onboarding steps. Each step reuses an existing
/// feature view wrapped with a "Continue / Skip for now" footer so the
/// wizard and settings share code.
struct OnboardingCoordinator: View {
    @Environment(FlashStore.self) private var flash
    @State private var store = OnboardingStore()

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
                    case .forwarding:
                        ForwardingStepView(
                            onContinue: { Task { await store.markForwardingVerified(); advance() } }
                        )
                    case .testCall:
                        TestCallStepView(onFinish: finish)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .background(FlynnColor.background)
            .toolbar {
                if store.currentStep != .websiteScrape {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Back") { store.back() }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if store.currentStep != .testCall {
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
                    .fill(step.rawValue <= store.currentStep.rawValue ? FlynnColor.primary : FlynnColor.gray200)
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
