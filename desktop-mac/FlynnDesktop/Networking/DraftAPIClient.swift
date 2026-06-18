import Foundation

/// Network client for the Flynn drafting + calendar endpoints.
/// Ported from iOS KeyboardDraftClient — same endpoints, longer timeout for desktop.
enum DraftAPIClient {
    enum ClientError: Error, LocalizedError {
        case notAuthenticated
        case limitReached
        case server(Int)
        case decode
        case network(Error)

        var errorDescription: String? {
            switch self {
            case .notAuthenticated: return "Sign in to Flynn to generate drafts"
            case .limitReached: return "Daily draft limit reached — upgrade to continue"
            case .server(let code): return "Server error (\(code))"
            case .decode: return "Unexpected server response"
            case .network(let e): return e.localizedDescription
            }
        }
    }

    static var apiBaseURL: URL {
        if let raw = ProcessInfo.processInfo.environment["FLYNN_API_URL"],
           let url = URL(string: raw) { return url }
        return URL(string: "https://flynnai-telephony.fly.dev")!
    }

    // MARK: - Draft replies

    static func fetchDrafts(
        messages: [String],
        draftCount: Int = 3,
        proposedSlots: [String]? = nil,
        source: String? = "accessibility"
    ) async throws -> [String] {
        guard let token = await AuthService.shared.currentJWT else {
            throw ClientError.notAuthenticated
        }
        let body = DraftRequest(
            messages: messages,
            draftCount: draftCount,
            proposedSlots: proposedSlots,
            source: source
        )
        let data = try await post(
            path: "api/keyboard/draft-replies",
            body: body,
            token: token,
            timeout: 15
        )
        guard let decoded = try? JSONDecoder().decode(DraftResponse.self, from: data) else {
            throw ClientError.decode
        }
        return decoded.drafts
    }

    /// Best-effort fire-and-forget accepted draft signal.
    static func recordAccepted(
        text: String,
        candidates: [String],
        pickedIndex: Int,
        source: String,
        messages: [String]
    ) {
        Task {
            guard let token = await AuthService.shared.currentJWT else { return }
            let body = AcceptDraftRequest(
                text: text,
                candidates: candidates,
                pickedIndex: pickedIndex,
                source: source,
                messages: messages
            )
            _ = try? await post(
                path: "api/keyboard/accept-draft",
                body: body,
                token: token,
                timeout: 8
            )
        }
    }

    // MARK: - Free/busy calendar slots

    static func freeBusySlots(windowDays: Int = 7) async throws -> [String] {
        guard let token = await AuthService.shared.currentJWT else {
            throw ClientError.notAuthenticated
        }
        let tz = TimeZone.current.identifier
        let body = FreeBusyRequest(windowDays: windowDays, timezone: tz)
        let data = try await post(
            path: "api/calendar/free-busy",
            body: body,
            token: token,
            timeout: 10
        )
        guard let decoded = try? JSONDecoder().decode(FreeBusyResponse.self, from: data) else {
            throw ClientError.decode
        }
        return decoded.slots
    }

    // MARK: - Private

    private static func post<Body: Encodable>(
        path: String,
        body: Body,
        token: String,
        timeout: TimeInterval
    ) async throws -> Data {
        var req = URLRequest(url: apiBaseURL.appendingPathComponent(path))
        req.httpMethod = "POST"
        req.timeoutInterval = timeout
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw ClientError.network(error)
        }

        guard let http = response as? HTTPURLResponse else { throw ClientError.server(-1) }
        if http.statusCode == 402 { throw ClientError.limitReached }
        guard (200...299).contains(http.statusCode) else {
            throw ClientError.server(http.statusCode)
        }
        return data
    }
}
