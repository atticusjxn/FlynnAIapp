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

    /// Run silently in the background — no app launch, latency hides in the switch
    /// to the messaging app + keyboard.
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
        // 1. OCR the screenshot on-device.
        let text: String
        do {
            text = try await ScreenshotOCR.recognizeText(from: screenshot.data)
        } catch {
            return .result(dialog: "Couldn't read that screenshot — try copying the message instead.")
        }

        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .result(dialog: "No message text found in that screenshot.")
        }
        let messages = [trimmed]

        // 2. Generate drafts now if we can; otherwise stage the messages so the
        //    keyboard drafts them. Either way the keyboard has work to show.
        do {
            let drafts = try await KeyboardDraftClient.fetchDrafts(messages: messages, source: "screenshot")
            SharedStore.stageScreenshotDraft(
                StagedScreenshotDraft(messages: messages, drafts: drafts)
            )
            return .result(dialog: "Replies are ready — open the Flynn keyboard.")
        } catch KeyboardDraftClient.ClientError.limitReached {
            SharedStore.stageScreenshotDraft(
                StagedScreenshotDraft(messages: messages, limitReached: true)
            )
            return .result(dialog: "You're out of free drafts today — open Flynn to go unlimited.")
        } catch {
            // Missing token / network / decode — let the keyboard finish the draft.
            SharedStore.stageScreenshotDraft(
                StagedScreenshotDraft(messages: messages, needsDraft: true)
            )
            return .result(dialog: "Captured — open the Flynn keyboard to see your replies.")
        }
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
