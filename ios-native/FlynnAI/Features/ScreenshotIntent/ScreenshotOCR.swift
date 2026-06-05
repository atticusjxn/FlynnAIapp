import Foundation
import Vision
import UIKit
import ImageIO

/// On-device OCR for a captured screenshot. Uses the modern Vision Swift API
/// (`RecognizeTextRequest`, iOS 18+) at the accurate level with language
/// correction. Fully offline, no permissions — the image arrives as bytes from
/// the Shortcut's "Take Screenshot" action via an `IntentFile`.
enum ScreenshotOCR {

    enum OCRError: Error { case badImage }

    /// Recognize text in the screenshot data and return it as a single
    /// conversation string (lines joined top-to-bottom). Empty string if nothing
    /// readable was found.
    static func recognizeText(from data: Data) async throws -> String {
        guard let cgImage = makeCGImage(from: data) else { throw OCRError.badImage }

        var request = RecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true

        let observations = try await request.perform(on: cgImage)

        // Reconstruct reading order: top-to-bottom (Vision's normalized origin is
        // bottom-left, so higher y = higher on screen), then left-to-right.
        let lines: [String] = observations
            .sorted { lhs, rhs in
                let l = lhs.boundingBox.cgRect
                let r = rhs.boundingBox.cgRect
                if abs(l.midY - r.midY) > 0.02 { return l.midY > r.midY }
                return l.minX < r.minX
            }
            .compactMap { $0.topCandidates(1).first?.string }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        return lines.joined(separator: "\n")
    }

    /// Screenshots are PNG and decode via `UIImage`; keep a `CGImageSource`
    /// fallback for other encodings (HEIC, CIImage-backed) where `.cgImage` is nil.
    private static func makeCGImage(from data: Data) -> CGImage? {
        if let cg = UIImage(data: data)?.cgImage { return cg }
        guard
            let src = CGImageSourceCreateWithData(data as CFData, nil),
            let cg = CGImageSourceCreateImageAtIndex(src, 0, nil)
        else { return nil }
        return cg
    }
}
