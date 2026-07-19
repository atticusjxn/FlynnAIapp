import Foundation

/// Payload shape for creating and updating a Client row. Optional fields map to
/// SQL NULL; the server fills in `id`, `user_id`, and timestamps.
struct ClientInput: Codable, Sendable {
    /// `clients.user_id` is NOT NULL. Prod does have a
    /// `clients_set_user_id_trigger` (BEFORE INSERT) that fills it from the
    /// session, but ClientsRepository.insert stamps it explicitly anyway so
    /// the insert doesn't silently depend on that trigger existing.
    var userId: UUID?
    /// Nullable on the table (added by the org-spine migration so clients can
    /// be adopted into the org spine incrementally). Best-effort: populated
    /// from OrgResolver when the user has an org, omitted when they don't —
    /// the pre-existing user-scoped RLS policies still cover access either way.
    var orgId: UUID?
    var name: String
    var phone: String?
    var email: String?
    var address: String?
    var notes: String?
    var businessType: String?
    var preferredContactMethod: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case orgId = "org_id"
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
    /// Seed an input from an existing DTO for editing. Ownership keys are left
    /// nil — an edit never reassigns a client's user or org, and sending them
    /// would just be a no-op patch.
    init(from dto: ClientDTO) {
        self.userId = nil
        self.orgId = nil
        self.name = dto.name
        self.phone = dto.phone
        self.email = dto.email
        self.address = dto.address
        self.notes = dto.notes
        self.businessType = dto.businessType
        self.preferredContactMethod = dto.preferredContactMethod
    }
}
