import Foundation
import Speech
import AVFoundation
import os

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
    /// Smoothed mic level, 0...1. Drives the reactive meter on the mic button
    /// and listening bars — real amplitude, not a canned animation.
    private(set) var level: Float = 0

    private var pipeline: VoiceAudioPipeline?
    /// Guards the whole async start: `state` only becomes `.listening` at the
    /// end, after two permission round-trips, so it can't protect against the
    /// mic button's repeated `onChanged` events during a single hold.
    private var isStarting = false

    /// Set when a stop lands while `startListening` is still in flight.
    ///
    /// On a first run the permission alert takes the touch, so the button's
    /// `onEnded` fires long before `state` becomes `.listening`. Every stop path
    /// keys off `isListening`, so they all no-op, and then the awaited start
    /// finally completes and opens the recogniser with nobody holding the
    /// button — the mic latches on for the rest of the session, meter running,
    /// UI stuck on "listening...". Reproduced on a clean install every time.
    /// The start path re-checks this after each `await` and tears down instead.
    private var stopRequested = false

    /// Only one mic can be live at a time, but Home, Brain and the contextual
    /// voice bar each own their own manager. Two live pipelines would share the
    /// one `AVAudioSession`, and whichever stopped first would deactivate the
    /// session out from under the other's running engine.
    private static weak var activeManager: VoiceCaptureManager?

    /// Call on mic-button press-down. Requests permission on first use.
    func startListening() async {
        guard state != .listening, !isStarting else { return }
        isStarting = true
        stopRequested = false
        defer { isStarting = false }
        transcript = ""
        level = 0

        guard await Self.requestSpeechAuthorization() == .authorized else {
            state = stopRequested ? .idle : .denied
            return
        }
        guard !stopRequested else { return }

        guard await Self.requestMicPermission() else {
            state = stopRequested ? .idle : .denied
            return
        }
        guard !stopRequested else { return }

        // Never leave a second engine running on the shared audio session.
        if let other = Self.activeManager, other !== self { other.finish() }

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
                onLevel: { [weak self] level in
                    Task { @MainActor in self?.level = level }
                },
                onEnd: { [weak self] in
                    Task { @MainActor in self?.finish() }
                }
            )
        } catch {
            state = .error("Couldn't start the microphone")
            return
        }

        // The finger can lift while the engine is spinning up, too.
        guard !stopRequested else {
            pipeline.stop()
            return
        }

        self.pipeline = pipeline
        Self.activeManager = self
        state = .listening
    }

    /// Call on mic-button release. The recogniser keeps finalising briefly
    /// after this returns — read `transcript` once `state` settles to `.idle`.
    ///
    /// Safe to call when idle, and safe to call while a start is still in
    /// flight: that case is precisely what `stopRequested` exists for.
    func stopListening() {
        if isStarting { stopRequested = true }
        finish()
    }

    private func finish() {
        pipeline?.stop()
        pipeline = nil
        if Self.activeManager === self { Self.activeManager = nil }
        if state == .listening { state = .idle }
        level = 0
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
    /// Only ever touched from inside the tap closure, which the audio engine
    /// calls serially on its own realtime thread — no concurrent writers, so
    /// this doesn't need locking despite the class being `@unchecked Sendable`.
    private var smoothedLevel: Float = 0

    /// Written once by `stop()` on the main actor, read on the realtime audio
    /// thread by the tap.
    ///
    /// `SFSpeechAudioBufferRecognitionRequest.append` after `endAudio` is
    /// invalid and raises an ObjC exception — thrown from the audio render
    /// thread, where Swift cannot catch it, so it takes the process down. The
    /// old teardown called `endAudio()` first and only then stopped the engine
    /// and removed the tap, leaving a window of a buffer or two (~21ms each at
    /// 48kHz) in which exactly that could happen. Ordering the teardown
    /// correctly closes most of it; this flag closes the rest, since
    /// `removeTap` does not promise that a callback already in flight won't
    /// still land. Uncontended `withLock` is a single atomic op.
    private let stopped = OSAllocatedUnfairLock(initialState: false)

    init() {
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-AU")) ?? SFSpeechRecognizer()
    }

    var isAvailable: Bool { recognizer?.isAvailable ?? false }

    struct Unavailable: Error {}

    func start(
        onTranscript: @escaping @Sendable (String) -> Void,
        onLevel: @escaping @Sendable (Float) -> Void,
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
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            guard let self, !self.stopped.withLock({ $0 }) else { return }
            req.append(buffer)
            let raw = Self.rmsLevel(of: buffer)
            // Fast attack / slower release: the meter should snap to a loud
            // word instantly but not flicker back to zero between syllables,
            // which is how every VU meter has read as "reactive" rather than
            // "twitchy" since analog ones existed.
            let coeff: Float = raw > self.smoothedLevel ? 0.7 : 0.2
            self.smoothedLevel += (raw - self.smoothedLevel) * coeff
            onLevel(self.smoothedLevel)
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

    /// Idempotent — the release path and the recogniser's own completion can
    /// both land here.
    func stop() {
        // Order matters. Silence the tap, tear down the engine, and only then
        // tell the request no more audio is coming: `append` after `endAudio`
        // is what kills the process. See `stopped`.
        stopped.withLock { $0 = true }
        if let engine {
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
        }
        engine = nil
        request?.endAudio()
        request = nil
        task?.cancel()
        task = nil
        smoothedLevel = 0
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// RMS of the buffer's first channel, mapped from dBFS onto a 0...1 range.
    /// Ordinary speech at arm's length from the phone sits roughly -35..-15
    /// dBFS on the built-in mic; below that is room tone, above is someone
    /// right on the mic or raising their voice.
    private static func rmsLevel(of buffer: AVAudioPCMBuffer) -> Float {
        guard let channel = buffer.floatChannelData?[0] else { return 0 }
        let frameCount = Int(buffer.frameLength)
        guard frameCount > 0 else { return 0 }
        var sum: Float = 0
        for i in 0..<frameCount { sum += channel[i] * channel[i] }
        let rms = sqrt(sum / Float(frameCount))
        let db = 20 * log10(max(rms, 1e-7))
        let minDb: Float = -50, maxDb: Float = -12
        return min(max((db - minDb) / (maxDb - minDb), 0), 1)
    }
}
