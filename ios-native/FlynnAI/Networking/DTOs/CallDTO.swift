import Foundation

struct CallDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let userId: UUID?
    let callSid: String?
    let fromNumber: String?
    let toNumber: String?
    let status: String?
    let duration: Int?
    let recordingUrl: String?
    let recordingSid: String?
    let transcriptionText: String?
    let transcriptionConfidence: Double?
    let jobId: UUID?
    let createdAt: Date?
    let updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case callSid = "call_sid"
        case fromNumber = "from_number"
        case toNumber = "to_number"
        case status
        case duration
        case recordingUrl = "recording_url"
        case recordingSid = "recording_sid"
        case transcriptionText = "transcription_text"
        case transcriptionConfidence = "transcription_confidence"
        case jobId = "job_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var hasTranscript: Bool {
        !(transcriptionText?.isEmpty ?? true)
    }

    var hasRecording: Bool {
        !(recordingUrl?.isEmpty ?? true)
    }
}
