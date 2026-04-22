import Foundation
import Supabase

/// Resolves the current user's `default_org_id` once per session. Phase 2 needs
/// this for the Money tab because quotes/invoices are scoped by `org_id`.
///
/// Source of truth in the RN app is the `users` table's `default_org_id` column
/// (see `src/screens/MoneyScreen.tsx` line 43–50). We read it directly.
///
/// Phase 3 will introduce a proper Session / OrgStore that the whole app shares;
/// for now, each Money store calls `OrgResolver.current()` on first load.
enum OrgResolver {
    enum OrgResolverError: LocalizedError {
        case notAuthenticated
        case missingDefaultOrg

        var errorDescription: String? {
            switch self {
            case .notAuthenticated: return "You need to be signed in to view this."
            case .missingDefaultOrg: return "Your account isn't linked to an organization yet."
            }
        }
    }

    private struct UserRow: Decodable {
        let defaultOrgId: UUID?
        enum CodingKeys: String, CodingKey {
            case defaultOrgId = "default_org_id"
        }
    }

    static func current(client: SupabaseClient = FlynnSupabase.client) async throws -> UUID {
        let session = try await client.auth.session
        let userId = session.user.id

        let row: UserRow = try await client
            .from("users")
            .select("default_org_id")
            .eq("id", value: userId.uuidString)
            .single()
            .execute()
            .value

        guard let orgId = row.defaultOrgId else {
            throw OrgResolverError.missingDefaultOrg
        }
        return orgId
    }
}
