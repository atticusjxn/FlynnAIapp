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
        case subscriptionRequired
        case server(String)

        var errorDescription: String? {
            switch self {
            case .notFound: return "We couldn't find a setup for this number."
            case .poolEmpty: return "We're setting up your number — you'll get a text shortly."
            case .subscriptionRequired: return "Start your free trial to bring her to life."
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

    // MARK: - Demo call (onboarding value moment)

    struct DemoCallStatus: Decodable {
        let id: String
        let status: String          // ringing | in_progress | completed | no_answer | failed | canceled
        let transcript: String?
        let extractedJob: ExtractedJob?

        struct ExtractedJob: Decodable {
            let serviceType: String?
            let callerName: String?
            enum CodingKeys: String, CodingKey {
                case serviceType = "service_type"
                case callerName = "caller_name"
            }
        }
        enum CodingKeys: String, CodingKey {
            case id, status, transcript
            case extractedJob = "extracted_job"
        }
    }

    /// Ask Flynn to ring the signed-in user's own mobile. Returns the demo-call
    /// id to poll. The server only ever dials the user's verified number.
    static func startDemoCall() async throws -> String {
        let body = try JSONEncoder().encode([String: String]())
        let (data, code) = try await rawRequest(path: "api/voice-onboarding/demo-call", method: "POST", body: body)
        guard (200..<300).contains(code) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw VoiceOnboardingError.server(message ?? "Couldn't place the call (\(code))")
        }
        struct Response: Decodable { let demo_call_id: String }
        return try JSONDecoder().decode(Response.self, from: data).demo_call_id
    }

    static func demoCallStatus(id: String) async throws -> DemoCallStatus {
        let (data, code) = try await rawRequest(path: "api/voice-onboarding/demo-call/\(id)", method: "GET", body: nil)
        guard (200..<300).contains(code) else {
            throw VoiceOnboardingError.server("status \(code)")
        }
        return try JSONDecoder().decode(DemoCallStatus.self, from: data)
    }

    // MARK: - Forwarding verification (Gate 2.9)

    struct ForwardingVerify: Decodable {
        let enabled: Bool
        let verificationId: String?
        let status: String?
        enum CodingKeys: String, CodingKey {
            case enabled
            case verificationId = "verification_id"
            case status
        }
    }

    /// Ask the server to place a test call that confirms the divert. Returns
    /// `enabled: false` when the feature is off (the app then relies on the
    /// user's own confirmation).
    static func startForwardingVerify() async throws -> ForwardingVerify {
        let body = try JSONEncoder().encode([String: String]())
        let (data, code) = try await rawRequest(path: "api/voice-onboarding/verify-forwarding", method: "POST", body: body)
        guard (200..<300).contains(code) else {
            throw VoiceOnboardingError.server("verify failed (\(code))")
        }
        return try JSONDecoder().decode(ForwardingVerify.self, from: data)
    }

    static func forwardingVerifyStatus(id: String) async throws -> ForwardingVerify {
        let (data, code) = try await rawRequest(path: "api/voice-onboarding/verify-forwarding/\(id)", method: "GET", body: nil)
        guard (200..<300).contains(code) else {
            throw VoiceOnboardingError.server("status \(code)")
        }
        return try JSONDecoder().decode(ForwardingVerify.self, from: data)
    }

    /// Like `request`, but returns the raw status code instead of mapping it to
    /// the claim-flow error cases (503 = pool empty, 402 = subscription) that
    /// don't apply to the demo endpoints.
    private static func rawRequest(path: String, method: String, body: Data?) async throws -> (Data, Int) {
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
        return (data, http.statusCode)
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
        if http.statusCode == 402 {
            throw VoiceOnboardingError.subscriptionRequired
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
