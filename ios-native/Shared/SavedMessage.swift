import Foundation

/// A canned message the user can tap to insert from the Flynn keyboard. Authored
/// and edited in the app (Settings → Quick messages), stored in the App Group so
/// the keyboard can read them. Use cases: an away/holiday auto-reply, standard
/// availability, a "book me in" link, deposit terms — anything the user types often.
struct SavedMessage: Codable, Identifiable, Hashable, Sendable {
    let id: UUID
    var title: String
    var body: String

    init(id: UUID = UUID(), title: String, body: String) {
        self.id = id
        self.title = title
        self.body = body
    }
}

extension SharedStore {
    /// The user's saved quick messages, shared between app and keyboard.
    ///
    /// Distinguishes "never touched" (no data written → return the seed defaults so
    /// the feature works the moment the keyboard is installed) from "explicitly
    /// emptied" (an empty array was written → return nothing). Once the user edits,
    /// the real array persists and the seed never returns.
    static var savedMessages: [SavedMessage] {
        get {
            let defaults = UserDefaults(suiteName: FlynnShared.appGroupId)
            guard let data = defaults?.data(forKey: FlynnShared.DefaultsKey.savedMessages) else {
                return SavedMessage.seedDefaults
            }
            return (try? JSONDecoder().decode([SavedMessage].self, from: data)) ?? []
        }
        set {
            let defaults = UserDefaults(suiteName: FlynnShared.appGroupId)
            if let data = try? JSONEncoder().encode(newValue) {
                defaults?.set(data, forKey: FlynnShared.DefaultsKey.savedMessages)
                // The keyboard is a separate process; force the write to disk so it
                // sees edits immediately (same reason as the staged-draft hand-off).
                defaults?.synchronize()
            }
        }
    }
}

extension SavedMessage {
    /// Shown until the user adds their own. A ready-to-use away message plus an
    /// availability example so the feature explains itself on first open.
    static let seedDefaults: [SavedMessage] = [
        SavedMessage(
            title: "Away",
            body: "hey unfortunately I'm away until July 20, otherwise I would have loved to help out"
        ),
    ]
}
