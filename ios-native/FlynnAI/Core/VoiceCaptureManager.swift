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
    /// Guards the whole async start. `state` only becomes `.listening` at the
    /// very end — after two permission round-trips and engine startup — so it
    /// cannot protect against re-entry. The mic button's DragGesture fires
    /// onChanged repeatedly during a hold, so without this every one of those
    /// events started another engine, and the second installTap(onBus: 0) on
    /// the shared input node threw "required condition is false: nullptr ==
    /// Tap()" — an ObjC exception Swift cannot catch, so the app died.
    private var isStarting = false

    /// Call on mic-button press-down. Requests permission on first use.
    func startListening() async {
        guard state != .listening, !isStarting else { return }
        isStarting = true
        defer { isStarting = false }
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
            // No .duckOthers: it is only meaningful for categories that play
            // audio, and pairing it with .record is an invalid combination on
            // some iOS versions.
            try session.setCategory(.record, mode: .measurement)
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
        // A zero-rate/zero-channel format means the input route isn't ready
        // (session lost to a call, hardware not attached). installTap throws on
        // it, so fail as a message rather than a crash.
        guard format.sampleRate > 0, format.channelCount > 0 else {
            state = .error("Couldn't start the microphone")
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
            return
        }
        // Belt-and-braces: the input node is shared, so clear any tap a
        // previous session left behind before installing ours.
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak req] buffer, _ in
            req?.append(buffer)
        }

        engine.prepare()
        do {
            try engine.start()
        } catch {
            // Leaving the tap installed here would make the *next* press throw
            // on installTap — the same crash, one hold later.
            inputNode.removeTap(onBus: 0)
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
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

    // Both of these MUST stay `nonisolated`.
    //
    // TCC (the privacy subsystem) invokes permission callbacks on a background
    // queue. Inside a @MainActor type, Swift infers these closures as
    // MainActor-isolated, so the runtime executor check fires on that
    // background queue, dispatch_assert_queue fails, and the app traps with
    // EXC_BREAKPOINT — which is why holding the mic killed the app on the very
    // first thing it did. `nonisolated` removes the inferred isolation;
    // resuming a continuation from any thread is safe, and the caller is async
    // so it hops back to the main actor on return.
    private nonisolated func requestSpeechAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { (continuation: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
    }

    private nonisolated func requestMicPermission() async -> Bool {
        await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }
}
