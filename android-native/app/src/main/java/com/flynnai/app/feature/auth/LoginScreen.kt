package com.flynnai.app.feature.auth

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.flynnai.app.ui.components.MascotPose
import com.flynnai.app.ui.onboarding.ob.MascotHero
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.onboarding.ob.OnboardingHeadline
import com.flynnai.app.ui.onboarding.ob.OnboardingScaffold
import com.flynnai.app.ui.onboarding.ob.RetroButton
import com.flynnai.app.ui.onboarding.ob.RetroField
import com.flynnai.app.ui.onboarding.ob.RetroVariant
import com.flynnai.app.ui.theme.FlynnTypography

private enum class LoginMode {
    Landing, PhoneEntry, PhoneVerify,
    EmailPicker, EmailPassword, EmailCode,
    Signup,
}

@Composable
fun LoginScreen(vm: AuthViewModel) {
    var mode by rememberSaveable { mutableStateOf(LoginMode.Landing) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var code by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }

    val isLoading by vm.isSubmitting.collectAsState()
    val error by vm.errorMessage.collectAsState()
    val awaiting by vm.awaitingEmailConfirmation.collectAsState()

    OnboardingScaffold(
        variant = 1,
        footer = {
            when (mode) {
                LoginMode.Landing -> RetroButton(
                    title = "Sign up with phone",
                    onClick = { mode = LoginMode.PhoneEntry },
                    isLoading = isLoading,
                )
                LoginMode.PhoneEntry -> RetroButton(
                    title = "Send code",
                    onClick = { vm.signInWithPhone(phone); mode = LoginMode.PhoneVerify },
                    isLoading = isLoading,
                    enabled = phone.length >= 8,
                )
                LoginMode.PhoneVerify -> RetroButton(
                    title = "Verify",
                    onClick = { vm.verifyPhoneOTP(phone, code) },
                    isLoading = isLoading,
                    enabled = code.length == 6,
                )
                LoginMode.EmailPicker -> RetroButton(
                    title = "Email + password",
                    onClick = { mode = LoginMode.EmailPassword },
                )
                LoginMode.EmailPassword -> RetroButton(
                    title = "Sign in",
                    onClick = { vm.signIn(email, password) },
                    isLoading = isLoading,
                    enabled = email.isNotBlank() && password.length >= 6,
                )
                LoginMode.EmailCode -> RetroButton(
                    title = if (code.isEmpty()) "Send magic link" else "Verify",
                    onClick = {
                        if (code.isEmpty()) vm.signInWithOTPEmail(email)
                        else vm.verifyEmailOTP(email, code)
                    },
                    isLoading = isLoading,
                    enabled = email.isNotBlank(),
                )
                LoginMode.Signup -> RetroButton(
                    title = "Create account",
                    onClick = { vm.signUp(email, password) },
                    isLoading = isLoading,
                    enabled = email.isNotBlank() && password.length >= 8,
                )
            }
        },
    ) {
        when (mode) {
            LoginMode.Landing -> LandingContent(
                onLogin = { mode = LoginMode.PhoneEntry },
                onEmailOptions = { mode = LoginMode.EmailPicker },
                onSignup = { mode = LoginMode.Signup },
            )
            LoginMode.PhoneEntry -> PhoneEntryContent(phone = phone, onPhoneChange = { phone = it })
            LoginMode.PhoneVerify -> PhoneVerifyContent(phone = phone, code = code, onCodeChange = { code = it })
            LoginMode.EmailPicker -> EmailPickerContent(
                onPassword = { mode = LoginMode.EmailPassword },
                onCode = { mode = LoginMode.EmailCode },
            )
            LoginMode.EmailPassword -> EmailPasswordContent(
                email = email, onEmailChange = { email = it },
                password = password, onPasswordChange = { password = it },
            )
            LoginMode.EmailCode -> EmailCodeContent(
                email = email, onEmailChange = { email = it },
                code = code, onCodeChange = { code = it },
            )
            LoginMode.Signup -> SignupContent(
                email = email, onEmailChange = { email = it },
                password = password, onPasswordChange = { password = it },
            )
        }

        if (error != null) {
            Spacer(Modifier.height(16.dp))
            Text(
                text = error!!,
                style = FlynnTypography.bodyMedium,
                color = OB.terra,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (awaiting) {
            Spacer(Modifier.height(16.dp))
            Text(
                text = "Check your email — tap the link to confirm your account.",
                style = FlynnTypography.bodyMedium,
                color = OB.olive,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun LandingContent(
    onLogin: () -> Unit,
    onEmailOptions: () -> Unit,
    onSignup: () -> Unit,
) {
    MascotHero(pose = MascotPose.Wave)
    Spacer(Modifier.height(24.dp))
    OnboardingHeadline(title = "Reply in", accentTitle = "your voice.")
    Spacer(Modifier.height(12.dp))
    Text(
        "Flynn drafts your customer texts and books the jobs — in seconds.",
        style = FlynnTypography.bodyLarge.copy(color = OB.ink.copy(alpha = 0.75f)),
    )
    Spacer(Modifier.height(32.dp))
    Row(verticalAlignment = Alignment.CenterVertically) {
        HorizontalDivider(modifier = Modifier.weight(1f), color = OB.ink.copy(alpha = 0.2f))
        Text("  or  ", style = FlynnTypography.labelMedium, color = OB.ink.copy(alpha = 0.4f))
        HorizontalDivider(modifier = Modifier.weight(1f), color = OB.ink.copy(alpha = 0.2f))
    }
    Spacer(Modifier.height(16.dp))
    RetroButton("Log in", onLogin, variant = RetroVariant.Secondary)
    Spacer(Modifier.height(12.dp))
    RetroButton("Sign up with email", onEmailOptions, variant = RetroVariant.Secondary)
}

@Composable
private fun PhoneEntryContent(phone: String, onPhoneChange: (String) -> Unit) {
    OnboardingHeadline(eyebrow = "Step 1 of 2", title = "Your phone", accentTitle = "number")
    Spacer(Modifier.height(24.dp))
    RetroField(
        value = phone,
        onValueChange = onPhoneChange,
        placeholder = "+61 400 000 000",
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
    )
}

@Composable
private fun PhoneVerifyContent(phone: String, code: String, onCodeChange: (String) -> Unit) {
    MascotHero(pose = MascotPose.Thinking)
    Spacer(Modifier.height(20.dp))
    OnboardingHeadline(eyebrow = "Step 2 of 2", title = "Enter the", accentTitle = "6-digit code")
    Spacer(Modifier.height(8.dp))
    Text("Sent to $phone", style = FlynnTypography.bodyMedium.copy(color = OB.ink.copy(alpha = 0.6f)))
    Spacer(Modifier.height(24.dp))
    RetroField(
        value = code,
        onValueChange = onCodeChange,
        placeholder = "000000",
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
    )
}

@Composable
private fun EmailPickerContent(onPassword: () -> Unit, onCode: () -> Unit) {
    OnboardingHeadline(title = "Sign in with", accentTitle = "email")
    Spacer(Modifier.height(32.dp))
    RetroButton("Email + password", onPassword)
    Spacer(Modifier.height(12.dp))
    RetroButton("Email magic link", onCode, variant = RetroVariant.Secondary)
}

@Composable
private fun EmailPasswordContent(
    email: String, onEmailChange: (String) -> Unit,
    password: String, onPasswordChange: (String) -> Unit,
) {
    OnboardingHeadline(title = "Welcome", accentTitle = "back")
    Spacer(Modifier.height(24.dp))
    RetroField(value = email, onValueChange = onEmailChange, placeholder = "Email",
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
    Spacer(Modifier.height(12.dp))
    RetroField(value = password, onValueChange = onPasswordChange, placeholder = "Password",
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
}

@Composable
private fun EmailCodeContent(
    email: String, onEmailChange: (String) -> Unit,
    code: String, onCodeChange: (String) -> Unit,
) {
    OnboardingHeadline(title = "Magic", accentTitle = "link")
    Spacer(Modifier.height(24.dp))
    RetroField(value = email, onValueChange = onEmailChange, placeholder = "Email",
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
    if (code.isNotEmpty() || email.isNotBlank()) {
        Spacer(Modifier.height(12.dp))
        RetroField(value = code, onValueChange = onCodeChange, placeholder = "6-digit code from email",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
    }
}

@Composable
private fun SignupContent(
    email: String, onEmailChange: (String) -> Unit,
    password: String, onPasswordChange: (String) -> Unit,
) {
    MascotHero(pose = MascotPose.ThumbsUp)
    Spacer(Modifier.height(20.dp))
    OnboardingHeadline(title = "Create your", accentTitle = "account")
    Spacer(Modifier.height(24.dp))
    RetroField(value = email, onValueChange = onEmailChange, placeholder = "Email",
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
    Spacer(Modifier.height(12.dp))
    RetroField(value = password, onValueChange = onPasswordChange, placeholder = "Password (8+ chars)",
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
}
