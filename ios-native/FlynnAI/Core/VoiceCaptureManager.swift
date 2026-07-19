import Foundation
import Speech
import AVFoundation

/// On-device push-to-talk transcription for the Home agent bar.
///
/// Voice-to-invoice MUST live in the main app, not the keyboard extension —
/// iOS keyboard extensions have no microphone access (Apple: "Custom
/// keyboards... have no access to the device microphone, so dictation input
/// is not possible", true since iOS 8). See memory flynn_payments_verified_facts
/// and ~/.claude/plans/iridescent-floating-moore.md.
///
/// Uses SFSpeechRecognizer with `requiresOnDeviceRecognition = true` where
/// available — free, private, no server round-trip just to get text; the
/// transcript is then sent to the agent turn over the network like any typed
/// message.
@MainActor
@Observable
final class VoiceCaptureManager {
    enum State: Equatable {
        case idle
        case listening
        case denied
        case error(String)
    }

    private(set) var state: State = .idle
    private(set) var transcript: String = ""

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-AU")) ?? SFSpeechRecognizer()
    private var audioEngine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    /// Call on mic-button press-down. Requests permission on first use.
    func startListening() async {
        guard state != .listening else { return }
        transcript = ""

        let speechStatus = await requestSpeechAuthorization()
        guard speechStatus == .authorized else {
            state = .denied
            return
        }
        let micGranted = await requestMicPermission()
        guard micGranted else {
            state = .denied
            return
        }
        guard let recognizer, recognizer.isAvailable else {
            state = .error("Speech recognition isn't available right now")
            return
        }

        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            state = .error("Couldn't start the microphone")
            return
        }

        let engine = AVAudioEngine()
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            req.requiresOnDeviceRecognition = true
        }

        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak req] buffer, _ in
            req?.append(buffer)
        }

        engine.prepare()
        do {
            try engine.start()
        } catch {
            state = .error("Couldn't start the microphone")
            return
        }

        audioEngine = engine
        request = req
        state = .listening

        task = recognizer.recognitionTask(with: req) { [weak self] result, error in
            guard let self else { return }
            Task { @MainActor in
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                }
                if error != nil || result?.isFinal == true {
                    self.stopEngine()
                }
            }
        }
    }

    /// Call on mic-button release. Returns the final transcript (may still be
    /// finalising briefly after this returns — callers should read
    /// `transcript` once `state` settles back to `.idle`).
    func stopListening() {
        request?.endAudio()
        stopEngine()
    }

    private func stopEngine() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine = nil
        request = nil
        task?.cancel()
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        if state == .listening { state = .idle }
    }

    private func requestSpeechAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
    }

    private func requestMicPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }
}
