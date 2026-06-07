import SwiftUI

/// Drives the app-wide voice command surface: hold the mic → record → upload →
/// expose a result the tab shell routes on. One shared instance lives in the tab
/// shell so the mic floats over every screen.
@MainActor
@Observable
final class VoiceCommandStore {
    enum Phase: Equatable { case idle, recording, processing }

    var phase: Phase = .idle
    /// The latest command result, for the view layer to route on (then clear).
    var lastResult: VoiceCommandResult?
    /// Reply drafts to present in a sheet (set when intent == reply).
    var replyDrafts: ReplyDrafts?
    /// A transient error message for the view to flash, then clear.
    var errorMessage: String?

    private let recorder = VoiceCommandRecorder()
    private var starting = false

    struct ReplyDrafts: Identifiable, Equatable {
        let id = UUID()
        let recipient: String?
        let drafts: [String]
    }

    /// Called when the mic press begins.
    func beginRecording() async {
        guard phase == .idle, !starting else { return }
        starting = true
        defer { starting = false }
        let granted = await recorder.requestPermission()
        guard granted else {
            errorMessage = "Microphone access is off — turn it on in Settings to talk to Flynn."
            return
        }
        // The press may have already ended during the permission prompt.
        do {
            try recorder.start()
            phase = .recording
        } catch {
            errorMessage = "Couldn't start recording — try again."
            phase = .idle
        }
    }

    /// Called when the mic press ends.
    func finishRecording() async {
        guard phase == .recording else {
            // Press ended before recording started (e.g. permission denied / quick tap).
            _ = recorder.stop()
            return
        }
        guard let audio = recorder.stop() else { phase = .idle; return } // too short
        phase = .processing
        do {
            let result = try await VoiceCommandClient.send(audio: audio)
            phase = .idle
            if result.intent == "unknown" && (result.transcript.isEmpty) {
                errorMessage = result.message ?? "Didn't catch that — try again."
            } else {
                lastResult = result
            }
        } catch VoiceCommandClient.ClientError.limitReached {
            phase = .idle
            errorMessage = "You've hit today's free limit — go Pro for unlimited."
        } catch {
            phase = .idle
            errorMessage = "Couldn't process that — try again."
        }
    }

    func clearResult() { lastResult = nil }
    func clearError() { errorMessage = nil }
}
