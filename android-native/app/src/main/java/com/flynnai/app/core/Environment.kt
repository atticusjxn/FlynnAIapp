package com.flynnai.app.core

object Environment {
    val supabaseUrl: String = "https://zvfeafmmtfplzpnocyjw.supabase.co"
    // Set via local.properties → BuildConfig in a later phase; empty string is safe for Phase 1
    val supabaseAnonKey: String = ""
    val flynnApiBaseUrl: String = "https://flynnai-telephony.fly.dev"
}
