import Foundation

/// Network client for the drafting endpoints. Calls the backend with the
/// long-lived keyboard JWT (minted by the main app, read from the shared
/// keychain). Lives in `Shared/` so BOTH the keyboard extension and the
/// app-process `ScreenshotDraftIntent` can reuse it. Kept tiny and
/// dependency-free to respect the keyboard's memory cap.
enum KeyboardDraftClient {
    enum ClientError: Error {
        case notConfigured        // missing API base URL or token
        case limitReached         // free daily draft cap hit (HTTP 402)
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
        guard (200...299).contains(http.statusCode) else { throw ClientError.server(http.statusCode) }
        guard let decoded = try? JSONDecoder().decode(DraftResponse.self, from: data) else {
            throw ClientError.decode
        }
        return DraftResult(drafts: decoded.drafts, agreedEvent: decoded.agreedEvent)
    }

    // MARK: - Screenshot OCR

    private struct OCRRequest: Encodable { let imageBase64: String }
    private struct OCRResponse: Decodable { let text: String }

    /// Send a screenshot to the server for Qwen VL OCR.
    /// Returns the extracted conversation text, or throws on network/auth/decode failure.
    static func ocrScreenshot(imageData: Data) async throws -> String {
        guard let base = baseURL(), let token = SharedSecureStore.keyboardToken else {
            throw ClientError.notConfigured
        }
        var req = URLRequest(url: base.appendingPathComponent("api/keyboard/ocr-screenshot"))
        req.httpMethod = "POST"
        req.timeoutInterval = 25
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(OCRRequest(imageBase64: imageData.base64EncodedString()))
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw ClientError.server(-1) }
        if http.statusCode == 402 { throw ClientError.limitReached }
        guard (200...299).contains(http.statusCode) else { throw ClientError.server(http.statusCode) }
        guard let decoded = try? JSONDecoder().decode(OCRResponse.self, from: data) else {
            throw ClientError.decode
        }
        return decoded.text
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
