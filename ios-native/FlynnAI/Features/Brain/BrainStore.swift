import Foundation
import Supabase

/// Business Brain store. Reads/writes `business_profiles` in the exact shape the
/// backend draft formatter consumes (services[].price_range, faqs[].question/answer,
/// hours_json keyed by full weekday names) so edits actually improve drafts.
@MainActor
@Observable
final class BrainStore {
    enum State: Equatable { case idle, loading, loaded, error(String) }

    var state: State = .idle
    var saving = false
    var rescanning = false

    var businessType = ""
    var businessDescription = ""
    var pricingNotes = ""
    var serviceArea = ""
    var websiteURL = ""
    var services: [EditService] = []
    var faqs: [EditFAQ] = []
    var days: [EditDay] = EditDay.week()

    struct EditService: Identifiable, Equatable { let id = UUID(); var name: String; var priceRange: String; var typicalDuration: String = "" }
    struct EditFAQ: Identifiable, Equatable { let id = UUID(); var question: String; var answer: String }
    struct EditDay: Identifiable, Equatable {
        let id = UUID(); let key: String; let label: String
        var isOpen: Bool; var open: String; var close: String

        static func week() -> [EditDay] {
            [("monday", "Mon"), ("tuesday", "Tue"), ("wednesday", "Wed"), ("thursday", "Thu"),
             ("friday", "Fri"), ("saturday", "Sat"), ("sunday", "Sun")]
                .map { EditDay(key: $0.0, label: $0.1, isOpen: false, open: "09:00", close: "17:00") }
        }
    }

    // MARK: Voice fill

    /// Folds confirmed voice proposals into the in-memory edit state. Nothing is
    /// persisted here — the user still has to hit Save, so a bad batch is one
    /// back-swipe away from being discarded.
    ///
    /// Text fields are replaced (the user just said them, so they win) but
    /// services are appended and de-duplicated by name, because someone adding a
    /// second service by voice shouldn't silently wipe the first.
    func apply(_ proposals: [BrainVoiceFill.Proposal]) {
        for p in proposals {
            let value = p.value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty else { continue }

            switch p.field {
            case .businessType: businessType = value
            case .businessDescription: businessDescription = value
            case .pricingNotes: pricingNotes = value
            case .serviceArea: serviceArea = value
            case .service:
                if let i = services.firstIndex(where: { $0.name.caseInsensitiveCompare(value) == .orderedSame }) {
                    if let detail = p.detail, !detail.isEmpty { services[i].priceRange = detail }
                } else {
                    services.append(EditService(name: value, priceRange: p.detail ?? ""))
                }
            case .hours:
                applyHoursSummary(value)
            }
        }
    }

    /// Parses the "Mon 7:00–16:00, Tue 7:00–16:00" summary the sheet shows back
    /// into the day toggles. Days it can't read are left alone rather than
    /// being closed, so a partial phrase never silently marks someone shut.
    private func applyHoursSummary(_ summary: String) {
        for chunk in summary.split(separator: ",") {
            let parts = chunk.trimmingCharacters(in: .whitespaces).split(separator: " ", maxSplits: 1)
            guard parts.count == 2 else { continue }
            let dayPrefix = parts[0].lowercased()
            let times = parts[1].replacingOccurrences(of: "–", with: "-").split(separator: "-")
            guard times.count == 2,
                  let i = days.firstIndex(where: { $0.key.hasPrefix(dayPrefix) })
            else { continue }
            days[i].isOpen = true
            days[i].open = times[0].trimmingCharacters(in: .whitespaces)
            days[i].close = times[1].trimmingCharacters(in: .whitespaces)
        }
    }

    // MARK: Load

    func load() async {
        state = .loading
        #if DEBUG
        if FlynnDemo.isOn {
            let b = FlynnDemo.brain
            businessType = b.businessType
            businessDescription = b.businessDescription
            pricingNotes = b.pricingNotes
            serviceArea = b.serviceArea
            websiteURL = b.websiteURL
            services = b.services.map {
                EditService(name: $0.name, priceRange: $0.priceRange, typicalDuration: $0.duration)
            }
            days = EditDay.week().map { day in
                guard let hours = b.openDays[day.key] else { return day }
                var open = day
                open.isOpen = true
                open.open = hours.open
                open.close = hours.close
                return open
            }
            state = .loaded
            return
        }
        #endif
        struct Svc: Decodable { let name: String?; let price_range: String?; let typical_duration: String? }
        struct Faq: Decodable { let question: String?; let answer: String? }
        struct Row: Decodable {
            let business_type: String?
            let ai_instructions: String?
            let pricing_notes: String?
            let service_areas: [String]?
            let website_url: String?
            let services: [Svc]?
            let faqs: [Faq]?
            let hours_json: [String: BrainDayIn]?
        }
        do {
            let session = try await FlynnSupabase.client.auth.session
            let rows: [Row] = try await FlynnSupabase.client
                .from("business_profiles")
                .select("business_type, ai_instructions, pricing_notes, service_areas, website_url, services, faqs, hours_json")
                .eq("user_id", value: session.user.id.uuidString)
                .limit(1)
                .execute()
                .value
            if let row = rows.first {
                businessType = row.business_type ?? ""
                businessDescription = row.ai_instructions ?? ""
                pricingNotes = row.pricing_notes ?? ""
                serviceArea = (row.service_areas ?? []).joined(separator: ", ")
                websiteURL = row.website_url ?? ""
                services = (row.services ?? []).compactMap { s in
                    guard let n = s.name, !n.isEmpty else { return nil }
                    return EditService(name: n, priceRange: s.price_range ?? "", typicalDuration: s.typical_duration ?? "")
                }
                faqs = (row.faqs ?? []).compactMap { f in
                    guard let q = f.question, let a = f.answer, !q.isEmpty else { return nil }
                    return EditFAQ(question: q, answer: a)
                }
                hydrateDays(row.hours_json)
            }
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    private func hydrateDays(_ hours: [String: BrainDayIn]?) {
        guard let hours else { return }
        days = days.map { day in
            var d = day
            // Accept either full ("monday") or short ("mon") keys.
            let short = String(day.key.prefix(3))
            if let h = hours[day.key] ?? hours[short] {
                d.isOpen = !(h.closed ?? false) && (h.open != nil)
                if let o = h.open { d.open = o }
                if let c = h.close { d.close = c }
            }
            return d
        }
    }

    struct BrainDayIn: Decodable { let open: String?; let close: String?; let closed: Bool? }

    // MARK: Save

    func save() async {
        struct SvcOut: Encodable { let name: String; let price_range: String?; let typical_duration: String? }
        struct FaqOut: Encodable { let question: String; let answer: String }
        struct DayOut: Encodable { let open: String; let close: String }
        struct Patch: Encodable {
            let business_type: String
            let ai_instructions: String
            let pricing_notes: String
            let service_areas: [String]
            let website_url: String?
            let services: [SvcOut]
            let faqs: [FaqOut]
            let hours_json: [String: DayOut]
        }

        let svc = services
            .filter { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty }
            .map { SvcOut(name: $0.name, price_range: $0.priceRange.isEmpty ? nil : $0.priceRange, typical_duration: $0.typicalDuration.isEmpty ? nil : $0.typicalDuration) }
        let fq = faqs
            .filter { !$0.question.trimmingCharacters(in: .whitespaces).isEmpty && !$0.answer.trimmingCharacters(in: .whitespaces).isEmpty }
            .map { FaqOut(question: $0.question, answer: $0.answer) }
        var hours: [String: DayOut] = [:]
        for d in days where d.isOpen { hours[d.key] = DayOut(open: d.open, close: d.close) }
        let areas = serviceArea.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }

        let payload = Patch(
            business_type: businessType,
            ai_instructions: businessDescription,
            pricing_notes: pricingNotes,
            service_areas: areas,
            website_url: websiteURL.isEmpty ? nil : websiteURL,
            services: svc,
            faqs: fq,
            hours_json: hours
        )

        saving = true
        defer { saving = false }
        do {
            let session = try await FlynnSupabase.client.auth.session
            var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/business-profile"))
            req.httpMethod = "PATCH"
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(payload)
            _ = try await URLSession.shared.data(for: req)
        } catch {
            FlynnLog.network.error("Brain save failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: Re-scan website

    func rescan() async {
        let url = websiteURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !url.isEmpty else { return }
        rescanning = true
        defer { rescanning = false }
        do {
            let session = try await FlynnSupabase.client.auth.session
            var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/scrape-website"), timeoutInterval: 120)
            req.httpMethod = "POST"
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: ["url": url, "applyConfig": true])
            _ = try await URLSession.shared.data(for: req)
            await load()
        } catch {
            FlynnLog.network.error("Brain rescan failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
