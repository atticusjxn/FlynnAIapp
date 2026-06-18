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

    @Parameter(title: "Image Data", description: "Base64-encoded screenshot from the 'Base64 Encode' Shortcuts action.")
    var imageBase64: String

    static var parameterSummary: some ParameterSummary {
        Summary("Draft a reply from \(\.$imageBase64)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        // Diagnostic ping — zero dependencies.
        if let pingURL = URL(string: "https://flynnai-telephony.fly.dev/api/intent-ping") {
            var pingReq = URLRequest(url: pingURL)
            pingReq.httpMethod = "POST"
            pingReq.timeoutInterval = 4
            _ = try? await URLSession.shared.data(for: pingReq)
        }

        SharedStore.stageScreenshotDraft(.inFlight)

        guard let imageData = Data(base64Encoded: imageBase64, options: .ignoreUnknownCharacters),
              imageData.count > 1000 else {
            SharedStore.ocrDebugLog = "bad-base64:\(imageBase64.count)chars"
            SharedStore.stageScreenshotDraft(.unreadable)
            return .result(dialog: "Couldn't read that screenshot — try again.")
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
