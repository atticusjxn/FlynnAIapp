package com.flynnai.app.data

import android.content.Context
import com.flynnai.app.core.Environment
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest

object SupabaseClient {
    fun create(context: Context): SupabaseClient = createSupabaseClient(
        supabaseUrl = Environment.supabaseUrl,
        supabaseKey = Environment.supabaseAnonKey,
    ) {
        install(Auth)
        install(Postgrest)
    }
}
