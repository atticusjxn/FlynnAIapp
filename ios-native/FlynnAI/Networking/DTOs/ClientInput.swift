import Foundation

/// Payload shape for creating and updating a Client row. Optional fields map to
/// SQL NULL; the server fills in `id`, `user_id`, and timestamps.
struct ClientInput: Codable, Sendable {
    var name: String
    var phone: String?
    var email: String?
    var address: String?
    var notes: String?
    var businessType: String?
    var preferredContactMethod: String?

    enum CodingKeys: String, CodingKey {
        case name
        case phone
        case email
        case address
        case notes
        case businessType = "business_type"
        case preferredContactMethod = "preferred_contact_method"
    }
}

extension ClientInput {
    /// Seed an input from an existing DTO for editing.
    init(from dto: ClientDTO) {
        self.name = dto.name
        self.phone = dto.phone
        self.email = dto.email
        self.address = dto.address
        self.notes = dto.notes
        self.businessType = dto.businessType
        self.preferredContactMethod = dto.preferredContactMethod
    }
}
