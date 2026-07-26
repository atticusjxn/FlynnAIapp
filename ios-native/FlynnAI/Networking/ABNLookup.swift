import Foundation

/// Australian Business Register name search.
///
/// Nobody knows their ABN off the top of their head, but everybody knows their
/// own business name — so the app searches the ABR by name and fills the number
/// in behind the scenes. Called straight from the device: the ABR GUID is a
/// rate-limit identifier rather than a credential, and going direct means this
/// keeps working independently of the Flynn backend.
enum ABNLookup {
    struct Result: Identifiable, Hashable, Sendable {
        let abn: String
        let name: String
        let state: String
        let postcode: String
        let isActive: Bool

        var id: String { "\(abn)-\(name)" }

        /// "12 345 678 901" — the way an ABN is written on an invoice.
        var formattedABN: String {
            let digits = abn.filter(\.isNumber)
            guard digits.count == 11 else { return abn }
            let groups = [digits.prefix(2), digits.dropFirst(2).prefix(3),
                          digits.dropFirst(5).prefix(3), digits.dropFirst(8)]
            return groups.joined(separator: " ")
        }

        var location: String {
            [state, postcode].filter { !$0.isEmpty }.joined(separator: " ")
        }
    }

    enum LookupError: Error, LocalizedError {
        case notConfigured
        case badResponse

        var errorDescription: String? {
            switch self {
            case .notConfigured: return "Business search isn't set up yet — type your ABN instead."
            case .badResponse: return "Couldn't reach the business register just now."
            }
        }
    }

    static var isConfigured: Bool { FlynnEnv.abrGUID != nil }

    /// Search the register by business or trading name. Cancellable — callers
    /// debounce by cancelling the in-flight task on each keystroke.
    static func search(name: String) async throws -> [Result] {
        guard let guid = FlynnEnv.abrGUID else { throw LookupError.notConfigured }
        let query = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard query.count >= 3 else { return [] }

        var components = URLComponents(string: "https://abr.business.gov.au/json/MatchingNames.aspx")
        components?.queryItems = [
            URLQueryItem(name: "name", value: query),
            URLQueryItem(name: "maxResults", value: "12"),
            URLQueryItem(name: "guid", value: guid),
        ]
        guard let url = components?.url else { throw LookupError.badResponse }

        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw LookupError.badResponse
        }
        return try parse(data)
    }

    /// The ABR's "json" endpoints actually serve JSONP — the payload arrives
    /// wrapped in `callback(...)`, so unwrap before decoding.
    static func parse(_ data: Data) throws -> [Result] {
        guard let raw = String(data: data, encoding: .utf8) else { throw LookupError.badResponse }
        guard let open = raw.firstIndex(of: "("), let close = raw.lastIndex(of: ")"), open < close else {
            throw LookupError.badResponse
        }
        let json = String(raw[raw.index(after: open)..<close])
        guard let payload = json.data(using: .utf8) else { throw LookupError.badResponse }

        struct Envelope: Decodable {
            struct Name: Decodable {
                let Abn: String?
                let AbnStatus: String?
                let Name: String?
                let State: String?
                let Postcode: String?
            }
            let Names: [Name]?
        }

        let envelope = try JSONDecoder().decode(Envelope.self, from: payload)
        var seen = Set<String>()
        return (envelope.Names ?? []).compactMap { entry -> Result? in
            guard let abn = entry.Abn, !abn.isEmpty,
                  let name = entry.Name, !name.isEmpty else { return nil }
            // The register returns one row per registered name, so the same ABN
            // repeats for trading names. Keep the first (highest-scoring) only.
            guard seen.insert(abn).inserted else { return nil }
            return Result(
                abn: abn,
                name: name,
                state: entry.State ?? "",
                postcode: entry.Postcode ?? "",
                isActive: (entry.AbnStatus ?? "").caseInsensitiveCompare("Active") == .orderedSame
            )
        }
    }
}
