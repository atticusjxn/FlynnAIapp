import SwiftUI

@MainActor
@Observable
final class QuoteStyleStore {
    var style: LearnedQuoteStyle?
    var sampleCount: Int = 0
    var isWorking = false
    var statusMessage: String?
    var errorMessage: String?

    private let repo = QuoteStyleRepository()

    var hasStyle: Bool { style != nil }

    func load() async {
        do {
            let resp = try await repo.get()
            style = resp.style
            sampleCount = resp.sampleCount ?? 0
        } catch { /* nothing learned yet / table absent — leave empty */ }
    }

    /// OCR a picked image of a past quote on-device, then learn from the text.
    func learnFromImage(_ data: Data) async {
        isWorking = true
        statusMessage = "Reading your quote…"
        defer { isWorking = false; statusMessage = nil }
        do {
            let text = try await ScreenshotOCR.recognizeText(from: data)
            guard text.trimmingCharacters(in: .whitespacesAndNewlines).count > 20 else {
                errorMessage = "Couldn't read enough from that image — try a clearer shot."
                return
            }
            try await apply(text: text, source: "screenshot")
        } catch QuoteStyleError.limitReached {
            errorMessage = "You've hit today's free limit — go Pro for unlimited."
        } catch {
            errorMessage = "Couldn't learn from that image — try again."
        }
    }

    func learnFromText(_ text: String) async {
        isWorking = true
        statusMessage = "Learning your style…"
        defer { isWorking = false; statusMessage = nil }
        do { try await apply(text: text, source: "paste") }
        catch QuoteStyleError.limitReached { errorMessage = "You've hit today's free limit — go Pro for unlimited." }
        catch { errorMessage = "Couldn't learn from that — try again." }
    }

    private func apply(text: String, source: String) async throws {
        let resp = try await repo.learn(text: text, source: source)
        style = resp.style
        sampleCount = resp.sampleCount ?? sampleCount
    }

    func reset() async {
        do {
            try await repo.reset()
            style = nil
            sampleCount = 0
        } catch { errorMessage = "Couldn't reset." }
    }
}
