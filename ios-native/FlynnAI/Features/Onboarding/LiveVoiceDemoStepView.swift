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

            // Waveform
            WaveformView(isActive: agent.isAgentSpeaking)
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
            .disabled(!agent.isConnected || !micPermissionGranted)
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
        startTimer()
    }
}

// MARK: - Animated waveform

private struct WaveformView: View {
    let isActive: Bool
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
                        let amplitude = (0.2 + 0.8 * abs(sin(phase + t * .pi * 3))) * centerY
                        let rect = CGRect(
                            x: x - barWidth / 2,
                            y: centerY - amplitude,
                            width: barWidth,
                            height: amplitude * 2
                        )
                        ctx.fill(Path(roundedRect: rect, cornerRadius: barWidth / 2), with: .color(barColor))
                    } else {
                        // Flat 1pt line when disconnected — prevents the "row of orange dots" bug
                        // caused by applying cornerRadius to a very short rect.
                        let rect = CGRect(
                            x: x - barWidth / 2,
                            y: centerY - 0.5,
                            width: barWidth,
                            height: 1
                        )
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

// MARK: - Voice demo agent (WebSocket + AVAudioEngine)

@MainActor
@Observable
final class VoiceDemoAgent: NSObject {
    private(set) var isConnected: Bool = false
    private(set) var isAgentSpeaking: Bool = false
    private(set) var latestTranscript: TranscriptLine?

    private var webSocket: URLSessionWebSocketTask?
    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var isMicActive: Bool = false

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

        let session = URLSession(configuration: .default)
        webSocket = session.webSocketTask(with: finalUrl)
        webSocket?.resume()
        isConnected = true

        setupAudioEngine()
        receiveLoop()
    }

    func disconnect() {
        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
        audioEngine?.stop()
        audioEngine = nil
        isConnected = false
        isAgentSpeaking = false
    }

    func startSpeaking() {
        guard isConnected, !isMicActive else { return }
        isMicActive = true
    }

    func stopSpeaking() {
        isMicActive = false
    }

    func injectText(_ text: String) {
        guard isConnected else { return }
        let msg: [String: Any] = ["type": "inject_text", "text": text]
        guard let data = try? JSONSerialization.data(withJSONObject: msg) else { return }
        let frame = URLSessionWebSocketTask.Message.string(String(data: data, encoding: .utf8)!)
        webSocket?.send(frame) { _ in }
        latestTranscript = TranscriptLine(text: text, isAgent: false)
    }

    private func setupAudioEngine() {
        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        engine.attach(player)
        let format = AVAudioFormat(standardFormatWithSampleRate: 16000, channels: 1)!
        engine.connect(player, to: engine.mainMixerNode, format: format)

        let micFormat = engine.inputNode.outputFormat(forBus: 0)
        engine.inputNode.installTap(onBus: 0, bufferSize: 4096, format: micFormat) { [weak self] buffer, _ in
            guard let self, self.isMicActive, let pcm = buffer.int16ChannelData?[0] else { return }
            let frameCount = Int(buffer.frameLength)
            let data = Data(bytes: pcm, count: frameCount * 2)
            let message = URLSessionWebSocketTask.Message.data(data)
            self.webSocket?.send(message) { _ in }
        }

        do {
            try engine.start()
        } catch {
            FlynnLog.network.error("Audio engine start failed: \(error.localizedDescription, privacy: .public)")
        }

        audioEngine = engine
        playerNode = player
        player.play()
    }

    private func receiveLoop() {
        webSocket?.receive { [weak self] result in
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
        let format = AVAudioFormat(standardFormatWithSampleRate: 16000, channels: 1)!
        let frameCount = AVAudioFrameCount(data.count / 2)
        guard frameCount > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return }
        buffer.frameLength = frameCount
        data.withUnsafeBytes { ptr in
            guard let int16Ptr = ptr.baseAddress?.assumingMemoryBound(to: Int16.self),
                  let dst = buffer.int16ChannelData?[0] else { return }
            dst.update(from: int16Ptr, count: Int(frameCount))
        }
        player.scheduleBuffer(buffer)
        Task { @MainActor in self.isAgentSpeaking = true }
    }

    private func handleTextFrame(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        let type = json["type"] as? String
        if type == "transcript", let t = json["text"] as? String {
            Task { @MainActor in
                self.latestTranscript = TranscriptLine(text: t, isAgent: true)
                self.isAgentSpeaking = false
            }
        } else if type == "agent_speaking" {
            Task { @MainActor in self.isAgentSpeaking = true }
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
