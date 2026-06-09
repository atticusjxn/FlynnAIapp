import SwiftUI

/// The keyboard setup steps, relocated out of the (now removed) onboarding wizard.
/// Presented as a sheet from the Home dashboard and pushed from Settings → Flynn
/// Keyboard. Reuses the existing InstallKeyboardStepView + CaptureSetupStepView
/// verbatim — only the container changed. Keyboard setup is an optional power-user
/// add-on now, not an entry gate.
struct KeyboardSetupFlow: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(FlashStore.self) private var flash
    @State private var path = NavigationPath()

    private enum Step: Hashable { case capture }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                OB.cream.ignoresSafeArea()
                InstallKeyboardStepView(onContinue: { path.append(Step.capture) })
            }
            .navigationDestination(for: Step.self) { _ in
                ZStack {
                    OB.cream.ignoresSafeArea()
                    CaptureSetupStepView(onFinish: finish)
                }
                .navigationBarBackButtonHidden(false)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } } }
        }
        .environment(\.colorScheme, .light)
        .tint(OB.orange)
    }

    private func finish() {
        // Reaching finish means the user set the keyboard up. Its own heartbeat only
        // fires once it's actually used, so record this to stop the home-screen nag.
        UserDefaults.standard.set(true, forKey: "flynn.keyboardAcknowledged")
        Task {
            await KeyboardBridge.sync()
            flash.success("Keyboard set up, you're good to go")
            dismiss()
        }
    }
}
