import Foundation

/// Network client for the keyboard's endpoints. Calls the backend with the
/// long-lived keyboard JWT (minted by the main app, read from the shared
/// keychain) because an extension cannot run the Supabase SDK to get a session.
/// Lives in `Shared/` so both targets can use it, and stays deliberately tiny and
/// dependency-free to respect the keyboard's ~30-60MB memory cap.
enum KeyboardDraftClient {
    enum ClientError: Error {
        case notConfigured        // missing API base URL or token
        case limitReached         // free daily draft cap hit (HTTP 402)
        /// The keyboard JWT was rejected (HTTP 401) — almost always the 60-day
        /// token having expired. Distinct from `.server` because the user has to
        /// open the app to re-provision, and telling them "network hiccup" leaves
        /// them retrying a button that can never succeed.
        case unauthorized
        case server(Int)
        case decode
    }

    private static func baseURL() -> URL? {
        guard let raw = SharedStore.apiBaseURL, let url = URL(string: raw) else { return nil }
        return url
    }

    /// Fetch reply drafts (and any calendar-verified agreed booking) for the
    /// accumulated customer messages.
    static func fetchDrafts(messages: [String], source: String? = nil) async throws -> DraftResult {
        guard let base = baseURL(), let token = SharedSecureStore.keyboardToken else {
            throw ClientError.notConfigured
        }

        var req = URLRequest(url: base.appendingPathComponent("api/keyboard/draft-replies"))
        req.httpMethod = "POST"
        req.timeoutInterval = 8
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(DraftRequest(messages: messages, source: source))

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw ClientError.server(-1) }
        if http.statusCode == 402 { throw ClientError.limitReached }
        if http.statusCode == 401 { throw ClientError.unauthorized }
        guard (200...299).contains(http.statusCode) else { throw ClientError.server(http.statusCode) }
        guard let decoded = try? JSONDecoder().decode(DraftResponse.self, from: data) else {
            throw ClientError.decode
        }
        return DraftResult(drafts: decoded.drafts, agreedEvent: decoded.agreedEvent)
    }

    // MARK: - Quick context (chips)

    /// Fetch the operator's open invoices, free slots and priced services in one
    /// cheap no-LLM call. Short timeout on purpose: the chips row renders from the
    /// App Group cache first and this only refreshes it, so it must never be the
    /// reason the keyboard feels slow.
    static func quickContext() async throws -> QuickContext {
        guard let base = baseURL(), let token = SharedSecureStore.keyboardToken else {
            throw ClientError.notConfigured
        }

        var req = URLRequest(url: base.appendingPathComponent("api/keyboard/quick-context"))
        req.httpMethod = "GET"
        req.timeoutInterval = 6
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw ClientError.server(-1) }
        if http.statusCode == 401 { throw ClientError.unauthorized }
        guard (200...299).contains(http.statusCode) else { throw ClientError.server(http.statusCode) }
        guard let decoded = try? JSONDecoder().decode(QuickContext.self, from: data) else {
            throw ClientError.decode
        }
        return decoded
    }

    // MARK: - Compose

    /// Expand the shorthand the operator typed into send-ready message options.
    /// Throws `limitReached` on 402 so the caller can show the upgrade nudge, same
    /// as `fetchDrafts`.
    static func compose(text: String, candidateCount: Int = 3) async throws -> [String] {
        guard let base = baseURL(), let token = SharedSecureStore.keyboardToken else {
            throw ClientError.notConfigured
        }

        var req = URLRequest(url: base.appendingPathComponent("api/keyboard/compose"))
        req.httpMethod = "POST"
        req.timeoutInterval = 12
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(ComposeRequest(text: text, candidateCount: candidateCount))

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw ClientError.server(-1) }
        if http.statusCode == 402 { throw ClientError.limitReached }
        if http.statusCode == 401 { throw ClientError.unauthorized }
        guard (200...299).contains(http.statusCode) else { throw ClientError.server(http.statusCode) }
        guard let decoded = try? JSONDecoder().decode(ComposeResponse.self, from: data) else {
            throw ClientError.decode
        }
        return decoded.drafts
    }

    // MARK: - Calendar

    private struct CalendarEventRequest: Encodable {
        let title: String
        let startISO: String
        let durationMin: Int
        let location: String?
        let customer: String?
    }

    /// Add an agreed event directly to the user's Google Calendar via the backend.
    /// Throws `ClientError.notConfigured` when no token/URL, or `ClientError.server`
    /// on HTTP error (including 404 when Google Calendar is not connected).
    static func addCalendarEvent(_ event: AgreedEvent) async throws {
        guard let base = baseURL(), let token = SharedSecureStore.keyboardToken else {
            throw ClientError.notConfigured
        }
        var req = URLRequest(url: base.appendingPathComponent("api/keyboard/add-calendar-event"))
        req.httpMethod = "POST"
        req.timeoutInterval = 10
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(CalendarEventRequest(
            title: event.title,
            startISO: event.startISO,
            durationMin: event.durationMin,
            location: event.location,
            customer: event.customer
        ))
        let (_, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw ClientError.server(-1) }
        if http.statusCode == 401 { throw ClientError.unauthorized }
        guard (200...299).contains(http.statusCode) else { throw ClientError.server(http.statusCode) }
    }

    /// Best-effort: tell the backend which draft the user accepted, with the full
    /// candidate set + pick index + source so it can learn voice AND substance.
    /// Fire-and-forget; never throws into the UI.
    static func recordAccepted(
        text: String,
        source: String = "clipboard",
        candidates: [String]? = nil,
        pickedIndex: Int? = nil,
        messages: [String]? = nil
    ) {
        guard let base = baseURL(), let token = SharedSecureStore.keyboardToken else { return }
        var req = URLRequest(url: base.appendingPathComponent("api/keyboard/accept-draft"))
        req.httpMethod = "POST"
        req.timeoutInterval = 6
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONEncoder().encode(
            AcceptDraftRequest(
                text: text,
                candidates: candidates,
                pickedIndex: pickedIndex,
                source: source,
                messages: messages
            )
        )
        let task = URLSession.shared.dataTask(with: req)
        task.resume()
    }
}
