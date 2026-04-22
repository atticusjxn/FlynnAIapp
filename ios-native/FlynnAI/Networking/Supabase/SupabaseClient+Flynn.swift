import Foundation
import Supabase

/// Shared Supabase client. The SDK caches the session internally and also lets us
/// hand it back session JSON from Keychain on cold start.
enum FlynnSupabase {
    static let client: SupabaseClient = {
        SupabaseClient(
            supabaseURL: FlynnEnv.supabaseURL,
            supabaseKey: FlynnEnv.supabaseAnonKey
        )
    }()
}
