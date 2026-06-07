import Foundation
import AVFoundation

/// Records a short held-mic clip to a temp m4a file for the voice command surface.
/// Mono 16 kHz AAC — small payloads, plenty for speech recognition.
@MainActor
final class VoiceCommandRecorder {
    private var recorder: AVAudioRecorder?
    private var fileURL: URL?

    /// Prompt for (or confirm) microphone permission. iOS 17+ API (min target 18).
    func requestPermission() async -> Bool {
        await AVAudioApplication.requestRecordPermission()
    }

    func start() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
        try session.setActive(true)

        // 16 kHz mono 16-bit WAV — the most universally-accepted ASR input format.
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("flynn-voice-\(UUID().uuidString).wav")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatLinearPCM),
            AVSampleRateKey: 16000,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
        ]
        let rec = try AVAudioRecorder(url: url, settings: settings)
        rec.record()
        recorder = rec
        fileURL = url
    }

    /// Stop and return the recorded audio, or nil if it was too short to be a command.
    func stop() -> Data? {
        recorder?.stop()
        recorder = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        guard let url = fileURL else { return nil }
        fileURL = nil
        let data = try? Data(contentsOf: url)
        try? FileManager.default.removeItem(at: url)
        // A near-empty file means an accidental tap — ignore it.
        if let data, data.count > 1200 { return data }
        return nil
    }
}
