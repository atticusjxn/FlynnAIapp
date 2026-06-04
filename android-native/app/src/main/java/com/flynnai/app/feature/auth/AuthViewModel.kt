package com.flynnai.app.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flynnai.app.FlynnApp
import io.github.jan.supabase.auth.OtpType
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.Phone
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class AuthViewModel : ViewModel() {

    private val client = FlynnApp.instance.supabase

    val sessionStatus: StateFlow<SessionStatus> = client.auth.sessionStatus
        .stateIn(viewModelScope, SharingStarted.Eagerly, SessionStatus.Initializing)

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage = _errorMessage.asStateFlow()

    private val _isSubmitting = MutableStateFlow(false)
    val isSubmitting = _isSubmitting.asStateFlow()

    private val _awaitingEmailConfirmation = MutableStateFlow(false)
    val awaitingEmailConfirmation = _awaitingEmailConfirmation.asStateFlow()

    init {
        viewModelScope.launch {
            runCatching { client.auth.awaitInitialization() }
        }
    }

    fun signIn(email: String, password: String) = run {
        client.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    fun signUp(email: String, password: String) = run {
        _awaitingEmailConfirmation.value = false
        // signUpWith returns Unit in supabase-kt 3.x; session change comes via sessionStatus flow
        client.auth.signUpWith(Email) {
            this.email = email
            this.password = password
        }
        // If still not authenticated after signUp, email confirmation is required
        if (sessionStatus.value !is SessionStatus.Authenticated) {
            _awaitingEmailConfirmation.value = true
        }
    }

    fun signInWithOTPEmail(email: String) = run {
        client.auth.signInWith(Email) { this.email = email }
    }

    fun verifyEmailOTP(email: String, token: String) = run {
        client.auth.verifyEmailOtp(type = OtpType.Email.EMAIL, email = email, token = token)
    }

    fun signInWithPhone(phone: String) = run {
        client.auth.signInWith(Phone) { this.phone = phone }
    }

    fun verifyPhoneOTP(phone: String, token: String) = run {
        client.auth.verifyPhoneOtp(type = OtpType.Phone.SMS, phone = phone, token = token)
    }

    fun signOut() = run { client.auth.signOut() }

    fun clearError() { _errorMessage.value = null }

    private fun run(block: suspend () -> Unit) {
        viewModelScope.launch {
            _errorMessage.value = null
            _isSubmitting.value = true
            try {
                block()
            } catch (e: Exception) {
                _errorMessage.value = e.message ?: "Something went wrong"
            } finally {
                _isSubmitting.value = false
            }
        }
    }
}
