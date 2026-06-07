import Foundation

/// Sends business profile updates to the backend REST API.
enum BusinessProfileService {
    struct UpdatePayload: Encodable {
        var businessType: String?
        var services: [BusinessServiceUpdate]?
        var pricingNotes: String?
        var aiInstructions: String?
        var websiteUrl: String?

        enum CodingKeys: String, CodingKey {
            case businessType = "business_type"
            case services, pricingNotes = "pricing_notes"
            case aiInstructions = "ai_instructions"
            case websiteUrl = "website_url"
        }
    }

    struct BusinessServiceUpdate: Encodable {
        var name: String
        var priceRange: String?
        enum CodingKeys: String, CodingKey {
            case name, priceRange = "price_range"
        }
    }

    static func update(_ payload: UpdatePayload) async throws {
        guard let token = await AuthService.shared.currentJWT else { return }
        var req = URLRequest(url: DraftAPIClient.apiBaseURL.appendingPathComponent("api/business-profile"))
        req.httpMethod = "PATCH"
        req.timeoutInterval = 15
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(payload)
        let (_, response) = try await URLSession.shared.data(for: req)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw URLError(.badServerResponse)
        }
        await BrainStore.shared.fetch()
    }
}
