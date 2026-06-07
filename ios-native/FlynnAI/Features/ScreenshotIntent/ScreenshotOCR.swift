import Foundation
import Vision
import UIKit
import ImageIO

/// On-device OCR for a captured screenshot. Uses the battle-tested
/// VNRecognizeTextRequest + VNImageRequestHandler API (available iOS 13+)
/// rather than the newer Vision Swift concurrency API, which can fail silently
/// in background App Intent contexts. Fully offline, no permissions needed.
enum ScreenshotOCR {

    enum OCRError: Error { case badImage; case visionFailed(Error) }

    /// Recognize text in the screenshot data and return it as a single
    /// conversation string (lines joined top-to-bottom).
    static func recognizeText(from data: Data) async throws -> String {
        guard let cgImage = makeCGImage(from: data) else {
            throw OCRError.badImage
        }

        return try await withCheckedThrowingContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                if let error {
                    continuation.resume(throwing: OCRError.visionFailed(error))
                    return
                }
                let observations = request.results as? [VNRecognizedTextObservation] ?? []
                // Reconstruct reading order: top-to-bottom (Vision's normalized origin
                // is bottom-left, so higher y = higher on screen), then left-to-right.
                let lines: [String] = observations
                    .sorted { lhs, rhs in
                        if abs(lhs.boundingBox.midY - rhs.boundingBox.midY) > 0.02 {
                            return lhs.boundingBox.midY > rhs.boundingBox.midY
                        }
                        return lhs.boundingBox.minX < rhs.boundingBox.minX
                    }
                    .compactMap { $0.topCandidates(1).first?.string }
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                continuation.resume(returning: lines.joined(separator: "\n"))
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([request])
            } catch {
                continuation.resume(throwing: OCRError.visionFailed(error))
            }
        }
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
