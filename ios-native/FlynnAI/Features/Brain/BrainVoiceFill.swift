import Foundation

/// Turns a spoken description of a business into Brain fields.
///
/// Nothing here writes to the Brain. It produces a *proposal* the user confirms
/// field by field, because this is the data every future reply is built from —
/// silently overwriting someone's pricing because a recogniser misheard "ninety"
/// as "nineteen" is the worst possible failure for a brain-first product.
enum BrainVoiceFill {

    /// One thing Flynn thinks it heard, with the value it wants to write.
    struct Proposal: Identifiable, Equatable {
        enum Field: String, Equatable {
            case businessType, businessDescription, pricingNotes, serviceArea
            case service, hours

            var label: String {
                switch self {
                case .businessType: return "Trade"
                case .businessDescription: return "About"
                case .pricingNotes: return "Pricing"
                case .serviceArea: return "Area"
                case .service: return "Service"
                case .hours: return "Hours"
                }
            }

            var systemImage: String {
                switch self {
                case .businessType: return "hammer.fill"
                case .businessDescription: return "text.alignleft"
                case .pricingNotes: return "dollarsign.circle.fill"
                case .serviceArea: return "map.fill"
                case .service: return "wrench.and.screwdriver.fill"
                case .hours: return "clock.fill"
                }
            }
        }

        let id = UUID()
        let field: Field
        /// What will be written. Editable before it's applied.
        var value: String
        /// Extra detail for services (price), shown under the value.
        var detail: String?
        /// Unticked proposals are ignored on apply.
        var accepted: Bool = true
    }

    struct Response: Decodable {
        let businessType: String?
        let businessDescription: String?
        let pricingNotes: String?
        let serviceArea: String?
        let services: [Service]?
        let hours: [Day]?

        struct Service: Decodable {
            let name: String?
            let priceRange: String?
            let typicalDuration: String?
        }

        struct Day: Decodable {
            let day: String?
            let open: String?
            let close: String?
            let closed: Bool?
        }

        var proposals: [Proposal] {
            var out: [Proposal] = []
            func add(_ field: Proposal.Field, _ value: String?) {
                guard let v = value?.trimmingCharacters(in: .whitespacesAndNewlines), !v.isEmpty else { return }
                out.append(Proposal(field: field, value: v))
            }
            add(.businessType, businessType)
            add(.businessDescription, businessDescription)
            add(.pricingNotes, pricingNotes)
            add(.serviceArea, serviceArea)

            for s in services ?? [] {
                guard let name = s.name?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty else { continue }
                let bits = [s.priceRange, s.typicalDuration].compactMap {
                    $0?.trimmingCharacters(in: .whitespacesAndNewlines)
                }.filter { !$0.isEmpty }
                out.append(Proposal(field: .service, value: name,
                                    detail: bits.isEmpty ? nil : bits.joined(separator: " · ")))
            }

            // Hours collapse into one chip — six separate rows for a working week
            // is exactly the tedium this feature exists to remove.
            let open = (hours ?? []).filter { ($0.closed != true) && $0.day?.isEmpty == false }
            if !open.isEmpty {
                let summary = open.compactMap { d -> String? in
                    guard let day = d.day, let o = d.open, let c = d.close else { return nil }
                    return "\(day.prefix(3).capitalized) \(o)–\(c)"
                }.joined(separator: ", ")
                if !summary.isEmpty {
                    out.append(Proposal(field: .hours, value: summary))
                }
            }
            return out
        }
    }

    /// Drives the confirmation sheet. `.sheet(isPresented:)` can build its
    /// content before state set in the same turn has propagated, which
    /// presented the sheet with an empty transcript and no rows; `.sheet(item:)`
    /// hands the values over with the presentation.
    struct Payload: Identifiable {
        let id = UUID()
        let transcript: String
        let proposals: [Proposal]
    }

    enum FillError: LocalizedError {
        case nothingUnderstood
        case server(String)

        var errorDescription: String? {
            switch self {
            case .nothingUnderstood:
                return "Couldn't pick anything out of that. Try naming your trade, prices or hours."
            case .server(let m): return m
            }
        }
    }

    /// POSTs the transcript for structuring.
    ///
    /// Backend contract: `POST api/business-profile/parse` with `{ "transcript": "…" }`
    /// returns any subset of the fields above. Absent fields are left untouched;
    /// it must never invent a value it didn't hear.
    static func parse(transcript: String) async throws -> [Proposal] {
        #if DEBUG
        if FlynnDemo.isOn { return FlynnDemo.brainProposals(for: transcript) }
        #endif
        let session = try await FlynnSupabase.client.auth.session
        var req = URLRequest(
            url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/business-profile/parse"),
            timeoutInterval: 30
        )
        req.httpMethod = "POST"
        req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["transcript": transcript])

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw FillError.server("Flynn couldn't process that just now.")
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let decoded = try decoder.decode(Response.self, from: data)
        let proposals = decoded.proposals
        guard !proposals.isEmpty else { throw FillError.nothingUnderstood }
        return proposals
    }
}
