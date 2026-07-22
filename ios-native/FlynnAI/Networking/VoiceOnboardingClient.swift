import Foundation

/// Client for the voice front-door claim flow (`/api/voice-onboarding/*`).
///
/// A prospect who called the ad number has a staged receptionist config keyed
/// to their phone. After phone-OTP sign-in this client fetches it, claims it
/// into their org, and allocates a pool number to bring the receptionist live.
/// Recovery path: the 6-char claim code from the SMS, for when they signed up
/// on a different number than they called from.
enum VoiceOnboardingClient {
    struct BusinessConfig: Decodable {
        let trade: String?
        let businessName: String?
        let ownerName: String?
        let serviceAreas: [String]?
        let hours: String?
        let calloutFee: String?
        let afterHoursPolicy: String?
        let notes: String?

        enum CodingKeys: String, CodingKey {
            case trade
            case businessName = "business_name"
            case ownerName = "owner_name"
            case serviceAreas = "service_areas"
            case hours
            case calloutFee = "callout_fee"
            case afterHoursPolicy = "after_hours_policy"
            case notes
        }
    }

    struct StagedSession: Decodable {
        let found: Bool
        let state: String?
        let businessConfig: BusinessConfig?

        enum CodingKeys: String, CodingKey {
            case found, state
            case businessConfig = "business_config"
        }
    }

    struct ClaimResult: Decodable {
        let claimed: Bool
        let businessName: String?
        let businessConfig: BusinessConfig?

        enum CodingKeys: String, CodingKey {
            case claimed
            case businessName = "business_name"
            case businessConfig = "business_config"
        }
    }

    struct AssignResult: Decodable {
        let phoneNumber: String
        let alreadyAssigned: Bool?

        enum CodingKeys: String, CodingKey {
            case phoneNumber = "phone_number"
            case alreadyAssigned = "already_assigned"
        }
    }

    enum VoiceOnboardingError: Error, LocalizedError {
        case notFound(codeRequired: Bool)
        case poolEmpty
        case server(String)

        var errorDescription: String? {
            switch self {
            case .notFound: return "We couldn't find a setup for this number."
            case .poolEmpty: return "We're setting up your number — you'll get a text shortly."
            case .server(let message): return message
            }
        }
    }

    /// Nil when there's nothing staged for this user's phone.
    static func stagedSession() async throws -> StagedSession? {
        let data = try await request(path: "api/voice-onboarding/session", method: "GET", body: nil)
        let session = try JSONDecoder().decode(StagedSession.self, from: data)
        return session.found ? session : nil
    }

    static func claim(code: String?) async throws -> ClaimResult {
        var body: Data?
        if let code, !code.isEmpty {
            body = try JSONEncoder().encode(["code": code])
        } else {
            body = try JSONEncoder().encode([String: String]())
        }
        let data = try await request(path: "api/voice-onboarding/claim", method: "POST", body: body)
        return try JSONDecoder().decode(ClaimResult.self, from: data)
    }

    static func assignNumber() async throws -> AssignResult {
        let body = try JSONEncoder().encode([String: String]())
        let data = try await request(path: "api/voice-onboarding/assign-number", method: "POST", body: body)
        return try JSONDecoder().decode(AssignResult.self, from: data)
    }

    private static func request(path: String, method: String, body: Data?) async throws -> Data {
        let session = try await FlynnSupabase.client.auth.session
        var request = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw VoiceOnboardingError.server("No response from Flynn")
        }
        if http.statusCode == 404 {
            let payload = try? JSONDecoder().decode([String: AnyDecodable].self, from: data)
            let codeRequired = (payload?["code_required"]?.value as? Bool) ?? false
            throw VoiceOnboardingError.notFound(codeRequired: codeRequired)
        }
        if http.statusCode == 503 {
            throw VoiceOnboardingError.poolEmpty
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw VoiceOnboardingError.server(message ?? "Something went wrong (\(http.statusCode))")
        }
        return data
    }
}

/// Minimal type-erased Decodable for reading mixed-type error payloads.
struct AnyDecodable: Decodable {
    let value: Any

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let bool = try? container.decode(Bool.self) { value = bool }
        else if let int = try? container.decode(Int.self) { value = int }
        else if let string = try? container.decode(String.self) { value = string }
        else { value = "" }
    }
}
