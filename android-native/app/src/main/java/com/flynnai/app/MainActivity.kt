package com.flynnai.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.flynnai.app.nav.FlynnNavHost
import com.flynnai.app.ui.theme.FlynnTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FlynnTheme {
                FlynnNavHost()
            }
        }
    }
}
