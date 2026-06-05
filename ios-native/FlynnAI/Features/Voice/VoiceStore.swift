import Foundation
import Supabase

struct ToneSampleDTO: Identifiable, Decodable, Equatable {
    let id: UUID
    let sampleText: String
    let source: String

    enum CodingKeys: String, CodingKey {
        case id
        case sampleText = "sample_text"
        case source
    }
}

@MainActor
@Observable
final class VoiceStore {
    enum State: Equatable { case idle, loading, loaded, error(String) }

    var state: State = .idle
    var samples: [ToneSampleDTO] = []

    /// Replies the user wrote (onboarding + manually added).
    var written: [ToneSampleDTO] { samples.filter { $0.source != "accepted" } }
    /// Replies Flynn learned from drafts the user accepted/sent.
    var learned: [ToneSampleDTO] { samples.filter { $0.source == "accepted" } }

    func load() async {
        state = .loading
        do {
            let session = try await FlynnSupabase.client.auth.session
            let rows: [ToneSampleDTO] = try await FlynnSupabase.client
                .from("tone_samples")
                .select("id, sample_text, source")
                .eq("user_id", value: session.user.id.uuidString)
                .order("created_at", ascending: false)
                .execute()
                .value
            samples = rows
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func delete(_ id: UUID) async {
        do {
            try await FlynnSupabase.client
                .from("tone_samples")
                .delete()
                .eq("id", value: id.uuidString)
                .execute()
            samples.removeAll { $0.id == id }
        } catch {
            FlynnLog.network.error("delete tone sample failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func update(_ id: UUID, text: String) async {
        struct Patch: Encodable { let sample_text: String }
        do {
            try await FlynnSupabase.client
                .from("tone_samples")
                .update(Patch(sample_text: text))
                .eq("id", value: id.uuidString)
                .execute()
            await load()
        } catch {
            FlynnLog.network.error("update tone sample failed: \(error.localizedDescription, privacy: .public)")
        }
    }
}
