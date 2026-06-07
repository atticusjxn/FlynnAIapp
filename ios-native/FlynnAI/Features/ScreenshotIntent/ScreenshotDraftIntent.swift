import AppIntents
import UniformTypeIdentifiers

/// The bridge for Flynn's recommended capture flow. A user-built Shortcut runs
/// "Take Screenshot" (which does NOT save to the camera roll) and passes the image
/// straight into this intent's `screenshot` parameter. The intent runs in the
/// background (`openAppWhenRun = false`): it OCRs the screenshot on-device, drafts
/// replies, and stages them in the App Group for the Flynn keyboard to auto-load.
///
/// It never reads the clipboard, so there's no "pasting from…" banner.
///
/// The pipeline always stages *something* so the keyboard is never a dead end:
/// finished drafts on success, otherwise the OCR'd messages with `needsDraft` so
/// the keyboard generates them, or a `limitReached` marker for the free-tier cap.
struct ScreenshotDraftIntent: AppIntent {
    static let title: LocalizedStringResource = "Capture with Flynn"
    static let description = IntentDescription(
        "Reads the message on your screen and gets replies ready in the Flynn keyboard."
    )

    static let openAppWhenRun: Bool = false

    @Parameter(title: "Screenshot", description: "The screenshot to read.", supportedContentTypes: [.image])
    var screenshot: IntentFile

    /// Renders `screenshot` as an inline placeholder in the Shortcuts editor so the
    /// "Take Screenshot" action's output attaches as a magic variable — instead of
    /// the bare file-picker "Choose" row you get with no summary.
    static var parameterSummary: some ParameterSummary {
        Summary("Draft a reply from \(\.$screenshot)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        // Diagnostic ping — tells us if perform() is being called at all (no auth needed).
        let pingBase = SharedStore.apiBaseURL ?? "https://flynnai-telephony.fly.dev"
        if let pingURL = URL(string: "\(pingBase)/api/intent-ping") {
            var pingReq = URLRequest(url: pingURL)
            pingReq.httpMethod = "POST"
            pingReq.timeoutInterval = 4
            _ = try? await URLSession.shared.data(for: pingReq)
        }

        // Signal immediately so the keyboard shows "Reading your screen…" while we wait.
        SharedStore.stageScreenshotDraft(.inFlight)

        // Read .data once — IntentFile is file-backed; a second read can return empty bytes.
        let imageData = screenshot.data
        guard imageData.count > 1000 else {
            SharedStore.ocrDebugLog = "empty-data:\(imageData.count)b"
            SharedStore.stageScreenshotDraft(.unreadable)
            return .result(dialog: "Couldn't read that screenshot — try copying the message instead.")
        }

        let text: String
        do {
            text = try await KeyboardDraftClient.ocrScreenshot(imageData: imageData)
        } catch {
            SharedStore.ocrDebugLog = "ocr-error:\(error)"
            SharedStore.stageScreenshotDraft(.unreadable)
            return .result(dialog: "Couldn't read that screenshot — try copying the message instead.")
        }

        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            SharedStore.ocrDebugLog = "ocr-empty"
            SharedStore.stageScreenshotDraft(.unreadable)
            return .result(dialog: "No message text found in that screenshot.")
        }

        SharedStore.ocrDebugLog = "ok:\(trimmed.count)c"
        SharedStore.stageScreenshotDraft(
            StagedScreenshotDraft(messages: [trimmed], needsDraft: true)
        )
        return .result(dialog: "Captured — open the Flynn keyboard.")
    }
}

/// Exposes the intent to the Shortcuts app and Spotlight so the user can build the
/// "Take Screenshot → Capture with Flynn" shortcut and bind it to a gesture.
struct FlynnShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ScreenshotDraftIntent(),
            phrases: [
                "Capture with \(.applicationName)",
                "Draft a reply with \(.applicationName)"
            ],
            shortTitle: "Capture with Flynn",
            systemImageName: "text.viewfinder"
        )
    }
}
