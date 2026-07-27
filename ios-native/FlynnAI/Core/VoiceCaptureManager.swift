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
///
/// ## Why the audio work lives outside this type
///
/// This class is `@MainActor` so the UI can observe `state`/`transcript`
/// directly. But every closure created inside a `@MainActor` method inherits
/// that isolation, and AVFoundation/Speech invoke their callbacks on their own
/// threads: the audio tap on the realtime render thread, the recognition task
/// on a Speech queue, TCC permission replies on a dispatch root queue. Under
/// Swift 6 the runtime checks the executor on entry, `dispatch_assert_queue`
/// fails, and the process traps with EXC_BREAKPOINT — the app died the instant
/// the mic was held.
///
/// Fixing that closure-by-closure is whack-a-mole, so all of it lives in
/// `VoiceAudioPipeline` below, which is deliberately NOT actor-isolated. It
/// talks back through `@Sendable` callbacks that hop to the main actor
/// explicitly.
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

    private var pipeline: VoiceAudioPipeline?
    /// Guards the whole async start: `state` only becomes `.listening` at the
    /// end, after two permission round-trips, so it can't protect against the
    /// mic button's repeated `onChanged` events during a single hold.
    private var isStarting = false

    /// Call on mic-button press-down. Requests permission on first use.
    func startListening() async {
        guard state != .listening, !isStarting else { return }
        isStarting = true
        defer { isStarting = false }
        transcript = ""

        guard await Self.requestSpeechAuthorization() == .authorized else {
            state = .denied
            return
        }
        guard await Self.requestMicPermission() else {
            state = .denied
            return
        }

        let pipeline = VoiceAudioPipeline()
        guard pipeline.isAvailable else {
            state = .error("Speech recognition isn't available right now")
            return
        }

        do {
            try pipeline.start(
                onTranscript: { [weak self] text in
                    Task { @MainActor in self?.transcript = text }
                },
                onEnd: { [weak self] in
                    Task { @MainActor in self?.finish() }
                }
            )
        } catch {
            state = .error("Couldn't start the microphone")
            return
        }

        self.pipeline = pipeline
        state = .listening
    }

    /// Call on mic-button release. The recogniser keeps finalising briefly
    /// after this returns — read `transcript` once `state` settles to `.idle`.
    func stopListening() {
        pipeline?.endAudio()
        finish()
    }

    private func finish() {
        pipeline?.stop()
        pipeline = nil
        if state == .listening { state = .idle }
    }

    // `nonisolated` is load-bearing on both of these, and `static` does NOT
    // imply it: a static member of a @MainActor type is still MainActor-
    // isolated, so the closure below inherits that isolation. TCC delivers its
    // reply on com.apple.root.default-qos, the executor check fails there, and
    // the app traps with EXC_BREAKPOINT. Confirmed from a symbolicated crash:
    //   closure #1 in closure #1 in static VoiceCaptureManager.requestSpeechAuthorization()
    //   <- swift_task_isCurrentExecutorWithFlagsImpl <- dispatch_assert_queue_fail
    // Resuming a continuation from any thread is safe, and the async caller
    // hops back to the main actor on return.
    private nonisolated static func requestSpeechAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { (continuation: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
    }

    private nonisolated static func requestMicPermission() async -> Bool {
        await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }
}

/// Owns the audio session, engine and recognition task. Not actor-isolated, so
/// the callbacks AVFoundation and Speech fire on their own threads carry no
/// isolation to assert. Start/stop are called from the main actor; the internal
/// state is only touched there and in callbacks that don't race with it, hence
/// `@unchecked Sendable`.
final class VoiceAudioPipeline: @unchecked Sendable {
    private let recognizer: SFSpeechRecognizer?
    private var engine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    init() {
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-AU")) ?? SFSpeechRecognizer()
    }

    var isAvailable: Bool { recognizer?.isAvailable ?? false }

    struct Unavailable: Error {}

    func start(
        onTranscript: @escaping @Sendable (String) -> Void,
        onEnd: @escaping @Sendable () -> Void
    ) throws {
        guard let recognizer else { throw Unavailable() }

        let session = AVAudioSession.sharedInstance()
        // No .duckOthers: it only applies to categories that play audio.
        try session.setCategory(.record, mode: .measurement)
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        let engine = AVAudioEngine()
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            req.requiresOnDeviceRecognition = true
        }

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        // A zero-rate/zero-channel format means the input route isn't ready
        // (session lost to a call, no hardware). installTap throws on it.
        guard format.sampleRate > 0, format.channelCount > 0 else {
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
            throw Unavailable()
        }

        // The input node is shared, so clear any tap left behind before
        // installing ours — a second tap on an occupied bus is an ObjC
        // exception Swift can't catch.
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            req.append(buffer)
        }

        engine.prepare()
        do {
            try engine.start()
        } catch {
            // Leaving the tap installed would make the next press throw.
            input.removeTap(onBus: 0)
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
            throw error
        }

        self.engine = engine
        self.request = req
        self.task = recognizer.recognitionTask(with: req) { result, error in
            if let result {
                onTranscript(result.bestTranscription.formattedString)
            }
            if error != nil || result?.isFinal == true {
                onEnd()
            }
        }
    }

    func endAudio() {
        request?.endAudio()
    }

    func stop() {
        engine?.stop()
        engine?.inputNode.removeTap(onBus: 0)
        engine = nil
        request = nil
        task?.cancel()
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
