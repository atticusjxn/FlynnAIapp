import Foundation

/// Entry in the shared voice-preset catalog (`voice_profiles` table). Phase 1 scope
/// is AU male + AU female Cartesia presets; `provider_voice_id` is the Cartesia UUID
/// and may be a placeholder until backfilled.
struct VoiceProfileDTO: Identifiable, Codable, Hashable, Sendable {
    let id: UUID
    let slug: String
    let displayName: String
    let provider: String
    let providerVoiceId: String
    let gender: String
    let locale: String
    let isPreset: Bool
    let previewUrl: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case slug
        case displayName = "display_name"
        case provider
        case providerVoiceId = "provider_voice_id"
        case gender
        case locale
        case isPreset = "is_preset"
        case previewUrl = "preview_url"
        case createdAt = "created_at"
    }

    enum Gender: String {
        case male
        case female
        case neutral
    }

    var genderEnum: Gender { Gender(rawValue: gender) ?? .neutral }
}
