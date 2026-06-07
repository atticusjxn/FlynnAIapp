import AppKit
import Carbon.HIToolbox

/// Drives the draft popup: capture → slot detection → API fetch → insert.
@MainActor
@Observable
final class DraftPopupViewModel {
    enum State {
        case idle
        case loading
        case ready([String])
        case editing(draft: String, original: [String])
        case error(String)
        case permissionNeeded
        case noConversation
    }

    private(set) var state: State = .idle
    private(set) var selectedIndex: Int = 0
    private(set) var appName: String = "Flynn"
    private(set) var sourceType: ConversationContext.SourceType = .native

    private var currentContext: ConversationContext?
    private var allDrafts: [String] = []
    private var onDismiss: (() -> Void)?

    // Source app captured BEFORE the popup appears — must be passed in before
    // NSWorkspace.frontmostApplication switches away from the user's app.
    var sourceApp: NSRunningApplication?

    init(onDismiss: (() -> Void)? = nil) {
        self.onDismiss = onDismiss
    }

    // MARK: - Invoke from hotkey

    func invoke() async {
        // 1. Check accessibility permission — if missing, open System Settings and show recovery UI
        if !AccessibilityPermission.isGranted {
            AccessibilityPermission.requestIfNeeded()
            AccessibilityPermission.openSystemSettings()
            state = .permissionNeeded
            return
        }

        // 2. Capture conversation using the pre-captured source app (not frontmostApplication,
        //    which may have switched to Flynn's own popup by the time this runs).
        let context: ConversationContext
        do {
            context = try AXConversationReader.capture(app: sourceApp)
        } catch AXConversationReader.ReadError.accessDenied {
            AccessibilityPermission.openSystemSettings()
            state = .permissionNeeded
            return
        } catch {
            state = .noConversation
            return
        }

        guard !context.isEmpty else {
            state = .noConversation
            return
        }

        currentContext = context
        appName = context.appName
        sourceType = context.sourceType
        selectedIndex = 0

        // 3. Check iMessage pre-draft cache
        if context.sourceType == .native,
           let threadID = context.threadIdentifier,
           let cached = DraftCache.shared.get(threadID: threadID) {
            allDrafts = cached
            state = .ready(cached)
            return
        }

        // 4. Fetch drafts from API
        state = .loading
        await loadDrafts(context: context)
    }

    func loadDrafts(context: ConversationContext) async {
        state = .loading
        do {
            // Detect time intent for slot proposal
            var slots: [String] = []
            if SlotFinder.conversationHasTimeIntent(context.messages) {
                slots = await SlotFinder.shared.nextFreeSlots(count: 3)
            }

            let drafts = try await DraftAPIClient.fetchDrafts(
                messages: context.messages,
                draftCount: 3,
                proposedSlots: slots.isEmpty ? nil : slots,
                source: context.sourceType.rawValue
            )

            allDrafts = drafts
            selectedIndex = 0
            state = .ready(drafts)
        } catch DraftAPIClient.ClientError.notAuthenticated {
            state = .error("Sign in to Flynn to generate drafts")
        } catch DraftAPIClient.ClientError.limitReached {
            state = .error("Daily draft limit reached — upgrade to continue")
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    // MARK: - Permission retry

    func retryPermission() {
        Task { await invoke() }
    }

    // MARK: - Navigation

    func selectNext() {
        if case .ready(let drafts) = state, selectedIndex < drafts.count - 1 {
            selectedIndex += 1
        }
    }

    func selectPrevious() {
        if selectedIndex > 0 { selectedIndex -= 1 }
    }

    // MARK: - Insert

    func insertSelected() {
        guard case .ready(let drafts) = state,
              drafts.indices.contains(selectedIndex) else { return }
        let draft = drafts[selectedIndex]
        performInsert(text: draft, drafts: drafts, index: selectedIndex)
    }

    func insertEdited(text: String) {
        guard case .editing(_, let original) = state else { return }
        performInsert(text: text, drafts: original, index: selectedIndex)
    }

    private func performInsert(text: String, drafts: [String], index: Int) {
        dismiss()

        // Short delay so the source app regains focus before we paste
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
            guard let self else { return }
            InsertionService.insert(text: text)
            DraftAPIClient.recordAccepted(
                text: text,
                candidates: drafts,
                pickedIndex: index,
                source: self.sourceType.rawValue,
                messages: self.currentContext?.messages ?? []
            )
        }
    }

    // MARK: - Edit mode

    func beginEditing() {
        if case .ready(let drafts) = state, drafts.indices.contains(selectedIndex) {
            state = .editing(draft: drafts[selectedIndex], original: drafts)
        }
    }

    func cancelEditing() {
        if case .editing(_, let original) = state {
            state = .ready(original)
        }
    }

    // MARK: - Redraft

    func redraft() {
        guard let context = currentContext else { return }
        Task { await loadDrafts(context: context) }
    }

    // MARK: - Dismiss

    func dismiss() {
        state = .idle
        onDismiss?()
    }
}
