import Foundation

/// Background service that watches iMessage for new inbound messages and
/// pre-drafts replies so they're ready when the user invokes the hotkey.
///
/// Only active when the user has explicitly opted in (UserDefaults key:
/// `iMessageLaneEnabled`) and Full Disk Access has been granted.
@MainActor
final class PreDraftEngine: @unchecked Sendable {
    static let shared = PreDraftEngine()

    @UserDefault("iMessageLaneEnabled", defaultValue: false)
    var isEnabled: Bool {
        didSet { isEnabled ? startIfAllowed() : stop() }
    }

    @UserDefault("iMessageLaneWatermark", defaultValue: Int64(0))
    private var watermarkRowID: Int64

    private(set) var isRunning = false
    private(set) var preDraftCount = 0
    private(set) var lastError: String?

    private let db = iMessageDatabase()
    private let watcher = iMessageWatcher()
    private var debounceTask: Task<Void, Never>?

    private init() {}

    // MARK: - Lifecycle

    func startIfAllowed() {
        guard isEnabled, iMessagePermission.isGranted else {
            if isEnabled && !iMessagePermission.isGranted {
                lastError = "Full Disk Access required — enable in System Settings"
            }
            return
        }
        isRunning = true
        lastError = nil
        watcher.onDatabaseChanged = { [weak self] in
            Task { @MainActor in self?.handleChange() }
        }
        watcher.start()
        // Initial scan on start
        handleChange()
    }

    func stop() {
        isRunning = false
        watcher.stop()
        debounceTask?.cancel()
    }

    // MARK: - Change handler

    private func handleChange() {
        // Debounce: wait 1.5s after last change to batch multiple rapid writes
        debounceTask?.cancel()
        debounceTask = Task {
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            guard !Task.isCancelled else { return }
            await self.processPendingMessages()
        }
    }

    private func processPendingMessages() async {
        guard iMessagePermission.isGranted else { stop(); return }
        let threads: [iMessageDatabase.Thread]
        do {
            threads = try db.fetchThreadsSince(rowID: watermarkRowID)
        } catch {
            lastError = error.localizedDescription
            return
        }

        guard !threads.isEmpty else { return }

        // Update watermark to the highest row we've seen
        let maxRow = threads.flatMap { $0.messages }.map { $0.rowID }.max() ?? watermarkRowID
        if maxRow > watermarkRowID { watermarkRowID = maxRow }

        // Pre-draft each thread with new inbound messages
        var count = 0
        for thread in threads {
            let inbound = thread.messages.filter { !$0.isFromMe }.map { $0.text }
            guard !inbound.isEmpty else { continue }

            let threadKey = thread.chatIdentifier + ":" + String(thread.latestRowID)

            // Skip if already cached
            if DraftCache.shared.get(threadID: threadKey) != nil { continue }

            do {
                let slots: [String] = SlotFinder.conversationHasTimeIntent(inbound)
                    ? await SlotFinder.shared.nextFreeSlots(count: 2)
                    : []

                let drafts = try await DraftAPIClient.fetchDrafts(
                    messages: inbound,
                    draftCount: 3,
                    proposedSlots: slots.isEmpty ? nil : slots,
                    source: "imessage_lane"
                )
                DraftCache.shared.store(drafts: drafts, threadID: threadKey)
                count += 1
            } catch {
                // Non-fatal — user will still get drafts on-demand
            }
        }

        preDraftCount += count
    }
}

// MARK: - Simple property wrapper for UserDefaults

@propertyWrapper
struct UserDefault<T> {
    let key: String
    let defaultValue: T

    init(_ key: String, defaultValue: T) {
        self.key = key
        self.defaultValue = defaultValue
    }

    var wrappedValue: T {
        get { UserDefaults.standard.object(forKey: key) as? T ?? defaultValue }
        set { UserDefaults.standard.set(newValue, forKey: key) }
    }
}
