import Foundation

struct ScreenshotCaptureDTO: Identifiable, Decodable {
    let id: String
    let createdAt: Date
    let summary: String?
    let extractedText: String?

    enum CodingKeys: String, CodingKey {
        case id, summary
        case createdAt = "created_at"
        case extractedText = "extracted_text"
    }
}
