import Foundation

/// Uploads a held-mic clip to the voice command endpoint, authenticated with the
/// Supabase session token (same pattern as `QuotesRepository`).
enum VoiceCommandClient {
    enum ClientError: Error { case limitReached, server(Int), decode }

    static func send(audio: Data, mimeType: String = "audio/wav") async throws -> VoiceCommandResult {
        let session = try await FlynnSupabase.client.auth.session
        let boundary = "Boundary-\(UUID().uuidString)"
        var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/voice/command"))
        req.httpMethod = "POST"
        req.timeoutInterval = 30
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func append(_ s: String) { body.append(s.data(using: .utf8)!) }
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"audio\"; filename=\"command.wav\"\r\n")
        append("Content-Type: \(mimeType)\r\n\r\n")
        body.append(audio)
        append("\r\n--\(boundary)--\r\n")
        req.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw ClientError.server(-1) }
        if http.statusCode == 402 { throw ClientError.limitReached }
        guard (200...299).contains(http.statusCode) else { throw ClientError.server(http.statusCode) }
        do { return try JSONDecoder().decode(VoiceCommandResult.self, from: data) }
        catch { throw ClientError.decode }
    }
}
