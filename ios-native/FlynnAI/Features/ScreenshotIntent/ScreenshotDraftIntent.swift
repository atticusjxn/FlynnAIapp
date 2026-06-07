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
        // Tell the keyboard a capture is in flight *immediately*, before any work — so
        // if the user switches to it before OCR/drafting finishes (the fast path), it
        // shows "reading…" and waits instead of falling through to the empty state.
        SharedStore.stageScreenshotDraft(.inFlight)

        // 1. OCR the screenshot on-device.
        let dataSize = screenshot.data.count
        let text: String
        do {
            text = try await ScreenshotOCR.recognizeText(from: screenshot.data)
            SharedStore.ocrDebugLog = "data:\(dataSize)b chars:\(text.count)"
        } catch {
            SharedStore.ocrDebugLog = "throw:\(error) data:\(dataSize)b"
            SharedStore.stageScreenshotDraft(.unreadable)
            return .result(dialog: "Couldn't read that screenshot — try copying the message instead.")
        }

        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            SharedStore.ocrDebugLog = "emptyTrim data:\(dataSize)b raw:\(text.count)chars"
            SharedStore.stageScreenshotDraft(.unreadable)
            return .result(dialog: "No message text found in that screenshot.")
        }
        let messages = [trimmed]

        // 2. Hand the OCR'd messages to the keyboard and let IT make the draft call.
        //    Doing the network request here — in iOS's throttled background-intent
        //    context — is what made replies land "heaps later." OCR is fast on-device,
        //    so we stage the messages immediately (sub-second) and the keyboard drafts
        //    them in the foreground at full speed the moment it appears.
        SharedStore.stageScreenshotDraft(
            StagedScreenshotDraft(messages: messages, needsDraft: true)
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
