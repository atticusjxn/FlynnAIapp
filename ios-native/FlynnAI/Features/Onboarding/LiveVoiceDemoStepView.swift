import SwiftUI
import AVFoundation

/// Step 4: Live two-way voice conversation with the user's actual AI receptionist.
/// Connects to /realtime/native-test via WebSocket, sending PCM 8kHz mic audio
/// and playing back Cartesia TTS audio from the server.
struct LiveVoiceDemoStepView: View {
    let store: OnboardingStore
    let onContinue: () -> Void

    @Environment(FlashStore.self) private var flash
    @State private var agent = VoiceDemoAgent()
    @State private var timer: Timer?
    @State private var elapsedSeconds: Int = 0
    @State private var micPermissionGranted: Bool = false
    @State private var isConnecting = true
    @State private var connectionError: String?
    @State private var transcript: [TranscriptLine] = []

    private let presetQuestions = [
        "What services do you offer?",
        "What's your call-out fee?",
        "Can I book for this Saturday?",
        "Are you licensed and insured?",
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                stepHeader(
                    eyebrow: "Step 4 of 6",
                    title: "Meet your AI receptionist",
                    subtitle: "This is exactly what your callers experience. Ask it anything."
                )

                callCard

                if !presetQuestions.isEmpty {
                    VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                        Text("Try asking:")
                            .flynnType(FlynnTypography.label)
                            .foregroundColor(FlynnColor.textSecondary)

                        ForEach(presetQuestions, id: \.self) { question in
                            Button(action: { agent.injectText(question) }) {
                                Text(question)
                                    .flynnType(FlynnTypography.bodyMedium)
                                    .foregroundColor(FlynnColor.primary)
                                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                                    .padding(.horizontal, FlynnSpacing.sm)
                                    .background(
                                        RoundedRectangle(cornerRadius: FlynnRadii.sm, style: .continuous)
                                            .fill(FlynnColor.primaryLight)
                                    )
                            }
                            .contentShape(Rectangle())
                        }
                    }
                }

                FlynnButton(
                    title: "End call — continue",
                    action: endAndContinue,
                    fullWidth: true
                )
            }
            .padding(FlynnSpacing.lg)
        }
        .task { await bootstrapDemo() }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            // Re-check mic permission if user went to Settings to enable it
            Task { await requestMicPermission() }
        }
        .onDisappear {
            timer?.invalidate()
            agent.disconnect()
        }
    }

    // MARK: Call card

    private var callCard: some View {
        VStack(spacing: FlynnSpacing.sm) {
            // Status bar
            HStack(spacing: FlynnSpacing.xs) {
                Circle()
                    .fill(statusDotColor)
                    .frame(width: 8, height: 8)
                Text(statusText)
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(statusTextColor)
                Spacer()
                if connectionError != nil {
                    Button("Retry") { Task { await bootstrapDemo() } }
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.primary)
                }
            }

            if let err = connectionError {
                Text(err)
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            // Waveform — amplitude driven by actual PCM RMS when agent speaks
            WaveformView(isActive: agent.isAgentSpeaking || agent.isMicActive, audioLevel: agent.audioLevel)
                .frame(height: 48)

            // Transcript
            if !transcript.isEmpty {
                ScrollView {
                    VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                        ForEach(transcript.suffix(4)) { line in
                            Text(line.text)
                                .flynnType(FlynnTypography.bodyMedium)
                                .foregroundColor(line.isAgent ? FlynnColor.textPrimary : FlynnColor.primary)
                                .frame(maxWidth: .infinity, alignment: line.isAgent ? .leading : .trailing)
                        }
                    }
                }
                .frame(maxHeight: 80)
            }

            // Push-to-talk button
            Button(action: {}) {
                Label("Hold to speak", systemImage: "mic.fill")
                    .flynnType(FlynnTypography.button)
                    .foregroundColor(FlynnColor.textPrimary)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in agent.startSpeaking() }
                    .onEnded { _ in agent.stopSpeaking() }
            )
            .padding(FlynnSpacing.sm)
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(cornerRadius: FlynnRadii.md)
            .disabled(!agent.isConnected)
        }
        .padding(FlynnSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
        .brutalistBorder(cornerRadius: FlynnRadii.md)
        .onChange(of: agent.latestTranscript) { _, newLine in
            if let line = newLine { transcript.append(line) }
        }
    }

    private var statusDotColor: Color {
        if agent.isConnected { return FlynnColor.error }
        if connectionError != nil { return FlynnColor.warning }
        return FlynnColor.gray300
    }

    private var statusText: String {
        if agent.isConnected { return "LIVE · \(formattedTime)" }
        if connectionError != nil { return "Couldn't connect" }
        return isConnecting ? "Connecting…" : "Ready — hold to speak"
    }

    private var statusTextColor: Color {
        if agent.isConnected { return FlynnColor.error }
        if connectionError != nil { return FlynnColor.warning }
        return FlynnColor.textTertiary
    }

    private var formattedTime: String {
        let m = elapsedSeconds / 60
        let s = elapsedSeconds % 60
        return String(format: "%d:%02d", m, s)
    }

    private func startTimer() {
        isConnecting = false
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak timer] _ in
            Task { @MainActor in
                self.elapsedSeconds += 1
                if self.elapsedSeconds >= 90 {
                    self.timer?.invalidate()
                    self.flash.info("Demo time's up — want your callers to experience this 24/7?")
                }
            }
            _ = timer
        }
    }

    private func requestMicPermission() async {
        let status = AVAudioApplication.shared.recordPermission
        if status == .undetermined {
            micPermissionGranted = await AVAudioApplication.requestRecordPermission()
        } else {
            micPermissionGranted = (status == .granted)
        }
        if !micPermissionGranted {
            flash.error("Microphone access denied — tap chips below to try preset questions")
        }
    }

    private func endAndContinue() {
        timer?.invalidate()
        agent.disconnect()
        onContinue()
    }

    private func bootstrapDemo() async {
        isConnecting = true
        connectionError = nil
        await requestMicPermission()
        await store.loadDemoSession()
        guard let wsUrl = store.demoWsUrl, let userId = store.demoUserId else {
            connectionError = "Couldn't reach the demo server. Check your connection and retry."
            isConnecting = false
            FlynnLog.network.error("Voice demo: no wsUrl/userId after loadDemoSession")
            return
        }
        await agent.connect(wsUrl: wsUrl, userId: userId)
        // Surface server-side errors (e.g. Deepgram 401) to the UI
        if let serverError = agent.serverError {
            connectionError = serverError
            isConnecting = false
            return
        }
        startTimer()
    }
}

// MARK: - Animated waveform

private struct WaveformView: View {
    let isActive: Bool
    var audioLevel: Float = 0  // 0–1 actual amplitude; 0 = use idle animation
    @State private var phase: Double = 0

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30)) { context in
            Canvas { ctx, size in
                let bars = 24
                let barWidth = size.width / CGFloat(bars * 2)
                let centerY = size.height / 2
                let barColor: Color = isActive ? FlynnColor.primary : FlynnColor.gray300
                for i in 0..<bars {
                    let x = CGFloat(i * 2 + 1) * barWidth
                    let t = Double(i) / Double(bars)
                    if isActive {
                        // When we have real amplitude data use it; otherwise fall back to
                        // a gentle idle animation so the waveform always looks alive.
                        let level = audioLevel > 0.01 ? Double(audioLevel) : 0.15
                        let amplitude = (level * abs(sin(phase + t * .pi * 3))) * centerY
                        let safeHeight = max(2.0, amplitude * 2)
                        let rect = CGRect(
                            x: x - barWidth / 2,
                            y: centerY - safeHeight / 2,
                            width: barWidth,
                            height: safeHeight
                        )
                        ctx.fill(Path(roundedRect: rect, cornerRadius: barWidth / 2), with: .color(barColor))
                    } else {
                        let rect = CGRect(x: x - barWidth / 2, y: centerY - 0.5, width: barWidth, height: 1)
                        ctx.fill(Path(rect), with: .color(barColor))
                    }
                }
            }
        }
        .onAppear {
            withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                phase = .pi * 2
            }
        }
    }
}

// MARK: - Transcript line

struct TranscriptLine: Identifiable, Equatable {
    let id = UUID()
    let text: String
    let isAgent: Bool
}

// MARK: - Thread-safe bridge for audio tap → WebSocket

/// Holds the two properties accessed from the AVAudioEngine tap closure, which
/// runs on the CoreAudio render thread (not the main actor). Storing them here
/// avoids the Swift 6 `dispatch_assert_queue_fail` crash that occurs when the
/// tap closure captures `self` and touches @MainActor-isolated ivars.
private final class AudioBridge: @unchecked Sendable {
    var isMicActive: Bool = false
    var webSocket: URLSessionWebSocketTask?
    /// RMS amplitude of the most-recent mic frame (0–1). Updated on CoreAudio thread;
    /// read on MainActor via a periodic Task dispatch.
    var micLevel: Float = 0
}

// MARK: - Voice demo agent (WebSocket + AVAudioEngine)

@MainActor
@Observable
final class VoiceDemoAgent: NSObject {
    private(set) var isConnected: Bool = false
    private(set) var isAgentSpeaking: Bool = false
    private(set) var isMicActive: Bool = false
    private(set) var audioLevel: Float = 0  // 0–1 RMS amplitude for waveform
    private(set) var latestTranscript: TranscriptLine?
    private(set) var serverError: String?

    private let bridge = AudioBridge()
    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var micLevelTimer: Timer?

    func connect(wsUrl: URL, userId: String) async {
        var components = URLComponents(url: wsUrl, resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "userId", value: userId)]
        guard let finalUrl = components.url else { return }

        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.defaultToSpeaker, .allowBluetoothHFP]
            )
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            FlynnLog.network.error("AVAudioSession setup failed: \(error.localizedDescription, privacy: .public)")
        }

        serverError = nil
        let session = URLSession(configuration: .default)
        let ws = session.webSocketTask(with: finalUrl)
        bridge.webSocket = ws
        ws.resume()
        isConnected = true

        setupAudioEngine()
        receiveLoop()
        startMicLevelTimer()

        // Tell the server to start the voice agent — it waits for this before
        // connecting to Deepgram so we don't waste a session on connection setup.
        sendJSON(["type": "start"])
    }

    private func startMicLevelTimer() {
        micLevelTimer?.invalidate()
        micLevelTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor [weak self] in
                guard let self, self.isMicActive else { return }
                self.audioLevel = self.bridge.micLevel
            }
        }
    }

    func disconnect() {
        micLevelTimer?.invalidate()
        micLevelTimer = nil
        bridge.webSocket?.cancel(with: .normalClosure, reason: nil)
        bridge.webSocket = nil
        bridge.isMicActive = false
        audioEngine?.stop()
        audioEngine = nil
        isConnected = false
        isAgentSpeaking = false
        isMicActive = false
    }

    func startSpeaking() {
        guard isConnected, !bridge.isMicActive else { return }
        bridge.isMicActive = true
        isMicActive = true
    }

    func stopSpeaking() {
        bridge.isMicActive = false
        isMicActive = false
    }

    func injectText(_ text: String) {
        guard isConnected else { return }
        sendJSON(["type": "inject_text", "text": text])
        latestTranscript = TranscriptLine(text: text, isAgent: false)
    }

    private func sendJSON(_ msg: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: msg),
              let str = String(data: data, encoding: .utf8) else { return }
        bridge.webSocket?.send(.string(str)) { _ in }
    }

    private func setupAudioEngine() {
        let (engine, player) = Self.buildAudioEngine(bridge: bridge)
        audioEngine = engine
        playerNode = player
    }

    // nonisolated so the tap closure it creates is NOT @MainActor-isolated.
    // CoreAudio calls the tap on RealtimeMessenger.mServiceQueue; if the closure
    // inherits @MainActor isolation Swift 6 fires dispatch_assert_queue_fail.
    //
    // Pass nil as the tap format so AVAudio uses the hardware's native format
    // instead of a format derived from inputNode.outputFormat() before engine start,
    // which can return a zero-sampleRate format and cause NSInvalidArgumentException.
    private nonisolated static func buildAudioEngine(bridge: AudioBridge) -> (AVAudioEngine, AVAudioPlayerNode) {
        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        engine.attach(player)
        let playbackFormat = AVAudioFormat(standardFormatWithSampleRate: 16000, channels: 1)!
        engine.connect(player, to: engine.mainMixerNode, format: playbackFormat)

        // nil format → native hardware format; avoids NSException from stale format before engine.start().
        // Hardware is typically 44100 or 48000 Hz; server expects 16000 Hz Linear16 PCM.
        // We downsample inline using the buffer's actual sampleRate so no magic constants needed.
        //
        // Always send audio frames — even silence — so Deepgram never receives a gap long
        // enough to trigger CLIENT_MESSAGE_TIMEOUT and kill the session.
        engine.inputNode.installTap(onBus: 0, bufferSize: 4096, format: nil) { buffer, _ in
            let frameCount = Int(buffer.frameLength)
            guard frameCount > 0, let floatData = buffer.floatChannelData?[0] else { return }
            let inputRate = buffer.format.sampleRate   // e.g. 44100 or 48000
            let targetRate = 16000.0
            let ratio = inputRate / targetRate          // e.g. 2.756 or 3.0
            let outputCount = max(1, Int(Double(frameCount) / ratio))
            var samples = [Int16](repeating: 0, count: outputCount)
            if bridge.isMicActive {
                var rmsSum: Float = 0
                for i in 0..<outputCount {
                    let srcIdx = min(Int(Double(i) * ratio), frameCount - 1)
                    let f = floatData[srcIdx]
                    samples[i] = Int16(max(-32768, min(32767, Int(f * 32767))))
                    rmsSum += f * f
                }
                bridge.micLevel = min(1.0, sqrt(rmsSum / Float(outputCount)) * 4)
            } else {
                bridge.micLevel = 0
            }
            // samples is all-zeros when mic is inactive → silence frames keep session alive
            let pcmData = samples.withUnsafeBytes { Data($0) }
            let b64 = pcmData.base64EncodedString()
            let json = "{\"type\":\"audio\",\"audio\":\"\(b64)\"}"
            bridge.webSocket?.send(.string(json)) { _ in }
        }

        do {
            try engine.start()
        } catch {
            FlynnLog.network.error("Audio engine start failed: \(error.localizedDescription, privacy: .public)")
        }
        player.play()
        return (engine, player)
    }

    private func receiveLoop() {
        bridge.webSocket?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .data(let data):
                    Task { @MainActor in self.playAudio(data) }
                case .string(let text):
                    Task { @MainActor in self.handleTextFrame(text) }
                @unknown default:
                    break
                }
                Task { @MainActor in self.receiveLoop() }
            case .failure(let error):
                FlynnLog.network.error("Voice demo WS receive failed: \(error.localizedDescription, privacy: .public)")
                Task { @MainActor in
                    self.isConnected = false
                    self.isAgentSpeaking = false
                }
            }
        }
    }

    private func playAudio(_ data: Data) {
        guard let engine = audioEngine, engine.isRunning, let player = playerNode else { return }
        // standardFormatWithSampleRate creates Float32 non-interleaved PCM — matching the
        // engine connection format. int16ChannelData is nil for Float32 buffers, so we
        // must convert Int16 → Float32 ourselves when filling floatChannelData.
        let format = AVAudioFormat(standardFormatWithSampleRate: 16000, channels: 1)!
        let frameCount = AVAudioFrameCount(data.count / 2)
        guard frameCount > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return }
        buffer.frameLength = frameCount
        var rmsSum: Float = 0
        data.withUnsafeBytes { ptr in
            guard let int16Ptr = ptr.baseAddress?.assumingMemoryBound(to: Int16.self),
                  let dst = buffer.floatChannelData?[0] else { return }
            for i in 0..<Int(frameCount) {
                let f = Float(int16Ptr[i]) / 32768.0
                dst[i] = f
                rmsSum += f * f
            }
        }
        let rms = sqrt(rmsSum / Float(frameCount))
        audioLevel = min(1.0, rms * 4)
        isAgentSpeaking = true
        player.scheduleBuffer(buffer) { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                self.audioLevel = 0
            }
        }
    }

    private func handleTextFrame(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        switch json["type"] as? String {
        case "ready":
            FlynnLog.network.info("Voice demo ready")
        case "audio":
            // Server sends agent TTS as base64 Linear16 PCM in a JSON envelope
            if let b64 = json["audio"] as? String, let pcm = Data(base64Encoded: b64) {
                Task { @MainActor in self.playAudio(pcm) }
            }
        case "agent_started_speaking":
            Task { @MainActor in self.isAgentSpeaking = true }
        case "agent_stopped_speaking", "agent_audio_done":
            Task { @MainActor in self.isAgentSpeaking = false }
        case "transcript":
            if let t = json["text"] as? String {
                Task { @MainActor in
                    self.latestTranscript = TranscriptLine(text: t, isAgent: true)
                }
            }
        case "user_started_speaking":
            Task { @MainActor in self.isAgentSpeaking = false }
        case "error":
            let msg = json["error"] as? String ?? "Unknown error"
            FlynnLog.network.error("Voice demo error from server: \(msg, privacy: .public)")
            Task { @MainActor in
                self.serverError = msg
                self.isConnected = false
                self.isAgentSpeaking = false
            }
        default:
            break
        }
    }
}

// MARK: - Eyebrow step header (local copy so file is self-contained)

@MainActor
@ViewBuilder
private func stepHeader(eyebrow: String, title: String, subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
        Text(eyebrow)
            .flynnType(FlynnTypography.overline)
            .foregroundColor(FlynnColor.primary)
        Text(title)
            .flynnType(FlynnTypography.h2)
            .foregroundColor(FlynnColor.textPrimary)
        Text(subtitle)
            .flynnType(FlynnTypography.bodyMedium)
            .foregroundColor(FlynnColor.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
}
