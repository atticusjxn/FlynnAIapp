package com.flynnai.app

import android.app.Application
import com.flynnai.app.data.SupabaseClient

class FlynnApp : Application() {

    val supabase by lazy { SupabaseClient.create(this) }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: FlynnApp
            private set
    }
}
