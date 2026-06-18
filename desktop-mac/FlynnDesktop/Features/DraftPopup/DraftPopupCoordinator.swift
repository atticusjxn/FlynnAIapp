import AppKit

/// Singleton coordinator: manages the popup window lifecycle, source-app tracking,
/// and focus restoration after insert/dismiss.
@MainActor
final class DraftPopupCoordinator {
    static let shared = DraftPopupCoordinator()

    private var popupWindow: DraftPopupWindow?
    private var viewModel: DraftPopupViewModel?
    private var sourceApp: NSRunningApplication?

    private init() {}

    // MARK: - Invoke (called from global hotkey)

    func invoke() {
        guard !AppState.shared.isPaused else { return }

        // Capture the currently frontmost app before we activate Flynn
        sourceApp = NSWorkspace.shared.frontmostApplication

        // If popup already visible, dismiss instead (toggle behaviour)
        if let existing = popupWindow, existing.isVisible {
            dismiss()
            return
        }

        // Get the focused text field frame BEFORE showing the popup (AX read while source app is still active)
        let fieldFrame = AXConversationReader.getFocusedFieldFrame(app: sourceApp)

        let vm = DraftPopupViewModel(onDismiss: { [weak self] in self?.dismiss() })
        vm.sourceApp = sourceApp
        viewModel = vm

        let window = DraftPopupWindow(viewModel: vm)
        popupWindow = window

        window.showNearTextField(fieldFrame)

        // Start capture + fetch in background
        Task { await vm.invoke() }
    }

    // MARK: - Browser conversation (from Chrome extension)

    func handleBrowserConversation(_ context: ConversationContext) async {
        guard !AppState.shared.isPaused else { return }
        // If popup is already loading, just update the context
        if let vm = viewModel {
            await vm.loadDrafts(context: context)
        } else {
            // No popup yet — create one
            let vm = DraftPopupViewModel(onDismiss: { [weak self] in self?.dismiss() })
            viewModel = vm

            let window = DraftPopupWindow(viewModel: vm)
            popupWindow = window

            window.showNearTextField(nil)

            await vm.loadDrafts(context: context)
        }
    }

    // MARK: - Dismiss + restore focus

    func dismiss() {
        popupWindow?.hide()
        popupWindow = nil
        viewModel = nil

        // Restore focus to the app that was frontmost before the hotkey
        if let src = sourceApp {
            src.activate(options: [.activateAllWindows])
            sourceApp = nil
        }
    }
}

