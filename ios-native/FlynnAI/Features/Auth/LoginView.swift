import SwiftUI

struct LoginView: View {
    enum Mode {
        case landing
        case phoneSignup    // phone entry framed as "Sign up with your phone number"
        case phoneLogin     // phone entry framed as "Welcome back" (pre-fills phone)
        case phoneVerify    // SMS OTP entry
        case emailPicker    // small chooser between email code / email password
        case emailPassword
        case emailCode
        case signup         // email + password signup
    }

    enum Field: Hashable {
        case email, password, code, businessName, phone, phoneCode
    }

    @Environment(AuthStore.self) private var auth

    @State private var mode: Mode = .landing
    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    @State private var businessName = ""
    @State private var phone = ""
    @State private var codeSent = false
    @FocusState private var focusedField: Field?

    private static let lastPhoneKey = "flynn.lastLoginPhone"

    var body: some View {
        ScrollView {
            VStack(spacing: FlynnSpacing.xl) {
                switch mode {
                case .landing:        landingBody
                case .phoneSignup:    phoneEntryBody(variant: .signup)
                case .phoneLogin:     phoneEntryBody(variant: .login)
                case .phoneVerify:    phoneVerifyBody
                case .emailPicker:    emailPickerBody
                case .emailPassword:  emailPasswordBody
                case .emailCode:      emailCodeBody
                case .signup:         signupBody
                }

                if let message = auth.errorMessage {
                    Text(message)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.error)
                        .multilineTextAlignment(.center)
                        .padding(FlynnSpacing.sm)
                        .background(FlynnColor.errorLight)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                if mode == .signup, auth.awaitingEmailConfirmation {
                    Text("Check your email — we sent a confirmation link to \(email). Tap it to finish signing up.")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.success)
                        .multilineTextAlignment(.center)
                        .padding(FlynnSpacing.sm)
                        .background(FlynnColor.successLight)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.vertical, FlynnSpacing.xxl)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(FlynnColor.background)
    }

    // MARK: - Landing (hero + phone CTA + Login link + tertiary buttons)

    private var landingBody: some View {
        VStack(spacing: FlynnSpacing.lg) {
            // Hero — fills empty top space
            VStack(spacing: FlynnSpacing.md) {
                HStack(spacing: 0) {
                    Text("Flynn")
                        .flynnType(FlynnTypography.displayLarge)
                        .foregroundColor(FlynnColor.textPrimary)
                    Text(".ai")
                        .flynnType(FlynnTypography.displayLarge)
                        .foregroundColor(FlynnColor.primary)
                }
                Text("Never miss\nanother lead.")
                    .flynnType(FlynnTypography.displayMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                    .multilineTextAlignment(.center)
                Text("The AI receptionist for tradies and service businesses.")
                    .flynnType(FlynnTypography.bodyLarge)
                    .foregroundColor(FlynnColor.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, FlynnSpacing.md)
            }
            .padding(.top, FlynnSpacing.xl)
            .padding(.bottom, FlynnSpacing.lg)

            // Big primary CTA
            FlynnButton(
                title: "Sign up with your phone number",
                action: { mode = .phoneSignup; phone = "" },
                fullWidth: true
            )

            // Smaller "Login" link
            Button(action: { mode = .phoneLogin; loadStoredPhone() }) {
                HStack(spacing: 4) {
                    Text("Already have an account?")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                    Text("Login")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.primary)
                        .fontWeight(.bold)
                }
            }

            // Divider
            HStack(spacing: FlynnSpacing.sm) {
                Rectangle().fill(FlynnColor.border).frame(height: 1)
                Text("OR")
                    .flynnType(FlynnTypography.bodySmall)
                    .foregroundColor(FlynnColor.textTertiary)
                Rectangle().fill(FlynnColor.border).frame(height: 1)
            }
            .padding(.horizontal, FlynnSpacing.sm)

            // Tertiary: Email + (Google placeholder — not yet implemented in Swift app)
            HStack(spacing: FlynnSpacing.sm) {
                FlynnButton(
                    title: "Email",
                    action: { mode = .emailPicker },
                    variant: .secondary,
                    fullWidth: true
                )
            }

            // Terms
            Text("By continuing, you accept our Terms & Privacy Policy.")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
                .multilineTextAlignment(.center)
                .padding(.top, FlynnSpacing.md)
        }
    }

    // MARK: - Phone entry

    private enum PhoneEntryVariant { case signup, login }

    private func phoneEntryBody(variant: PhoneEntryVariant) -> some View {
        VStack(spacing: FlynnSpacing.md) {
            backRow
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                Text(variant == .signup ? "Sign up with your phone number" : "Welcome back")
                    .flynnType(FlynnTypography.displayMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                Text("We'll text you a 6-digit code to verify it's you.")
                    .flynnType(FlynnTypography.bodyLarge)
                    .foregroundColor(FlynnColor.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            FlynnTextField(
                label: "Mobile number",
                text: $phone,
                placeholder: "+61 412 345 678",
                keyboardType: .phonePad,
                textContentType: .telephoneNumber,
                submitLabel: .send,
                onSubmit: submitSendPhoneCode
            )
            .focused($focusedField, equals: .phone)

            FlynnButton(
                title: "Send code",
                action: submitSendPhoneCode,
                fullWidth: true,
                isLoading: auth.isSubmitting
            )
        }
    }

    // MARK: - Phone verify (OTP)

    private var phoneVerifyBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            backRow
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                Text("Enter your code")
                    .flynnType(FlynnTypography.displayMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                Text("Sent to \(phone)")
                    .flynnType(FlynnTypography.bodyLarge)
                    .foregroundColor(FlynnColor.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            FlynnTextField(
                label: "6-digit code",
                text: $code,
                placeholder: "000000",
                keyboardType: .numberPad,
                textContentType: .oneTimeCode,
                submitLabel: .done,
                onSubmit: submitVerifyPhoneCode
            )
            .focused($focusedField, equals: .phoneCode)

            FlynnButton(
                title: "Verify",
                action: submitVerifyPhoneCode,
                fullWidth: true,
                isLoading: auth.isSubmitting
            )

            Button("Use a different number") {
                mode = .phoneSignup
                code = ""
            }
            .flynnType(FlynnTypography.bodyMedium)
            .foregroundColor(FlynnColor.primary)
        }
    }

    // MARK: - Email picker

    private var emailPickerBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            backRow
            Text("Continue with email")
                .flynnType(FlynnTypography.displayMedium)
                .foregroundColor(FlynnColor.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            FlynnButton(title: "Email code (no password)", action: { mode = .emailCode }, variant: .secondary, fullWidth: true)
            FlynnButton(title: "Email & password", action: { mode = .emailPassword }, variant: .secondary, fullWidth: true)
            HStack(spacing: 4) {
                Text("New here?")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
                Button("Sign up with email") { mode = .signup }
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.primary)
                    .fontWeight(.bold)
            }
            .padding(.top, FlynnSpacing.md)
        }
    }

    // MARK: - Email + password (existing)

    private var emailPasswordBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            backRow
            Text("Log in")
                .flynnType(FlynnTypography.displayMedium)
                .foregroundColor(FlynnColor.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            FlynnTextField(
                label: "Email",
                text: $email,
                placeholder: "name@company.com",
                keyboardType: .emailAddress,
                textContentType: .emailAddress,
                autocapitalization: .never,
                autocorrection: false,
                submitLabel: .next,
                onSubmit: { focusedField = .password }
            )
            .focused($focusedField, equals: .email)
            FlynnTextField(
                label: "Password",
                text: $password,
                placeholder: "Enter your password",
                isSecure: true,
                textContentType: .password,
                submitLabel: .done,
                onSubmit: submitSignIn
            )
            .focused($focusedField, equals: .password)
            FlynnButton(title: "Log in", action: submitSignIn, fullWidth: true, isLoading: auth.isSubmitting)
        }
    }

    // MARK: - Email code (OTP)

    private var emailCodeBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            backRow
            Text("Log in with email code")
                .flynnType(FlynnTypography.displayMedium)
                .foregroundColor(FlynnColor.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            FlynnTextField(
                label: "Email",
                text: $email,
                placeholder: "name@company.com",
                keyboardType: .emailAddress,
                textContentType: .emailAddress,
                autocapitalization: .never,
                autocorrection: false,
                submitLabel: codeSent ? .next : .send,
                onSubmit: { codeSent ? (focusedField = .code) : submitSendEmailCode() }
            )
            .focused($focusedField, equals: .email)
            .disabled(codeSent)

            if codeSent {
                FlynnTextField(
                    label: "6-digit code",
                    text: $code,
                    placeholder: "000000",
                    keyboardType: .numberPad,
                    textContentType: .oneTimeCode,
                    submitLabel: .done,
                    onSubmit: submitVerifyEmailCode
                )
                .focused($focusedField, equals: .code)
            }

            FlynnButton(
                title: codeSent ? "Verify code" : "Send login code",
                action: codeSent ? submitVerifyEmailCode : submitSendEmailCode,
                fullWidth: true,
                isLoading: auth.isSubmitting
            )
        }
    }

    // MARK: - Email signup

    private var signupBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            backRow
            Text("Sign up with email")
                .flynnType(FlynnTypography.displayMedium)
                .foregroundColor(FlynnColor.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            FlynnTextField(
                label: "Business name",
                text: $businessName,
                placeholder: "Acme Plumbing",
                textContentType: .organizationName,
                submitLabel: .next,
                onSubmit: { focusedField = .email }
            )
            .focused($focusedField, equals: .businessName)
            FlynnTextField(
                label: "Email",
                text: $email,
                placeholder: "name@company.com",
                keyboardType: .emailAddress,
                textContentType: .emailAddress,
                autocapitalization: .never,
                autocorrection: false,
                submitLabel: .next,
                onSubmit: { focusedField = .password }
            )
            .focused($focusedField, equals: .email)
            FlynnTextField(
                label: "Password",
                text: $password,
                placeholder: "Create a password",
                isSecure: true,
                textContentType: .newPassword,
                submitLabel: .done,
                onSubmit: submitSignUp
            )
            .focused($focusedField, equals: .password)
            FlynnButton(title: "Sign up", action: submitSignUp, fullWidth: true, isLoading: auth.isSubmitting)
        }
    }

    // MARK: - Shared back row

    private var backRow: some View {
        HStack {
            Button(action: { mode = .landing; codeSent = false; code = "" }) {
                Image(systemName: "arrow.left")
                    .font(.title2)
                    .foregroundColor(FlynnColor.textPrimary)
                    .frame(width: 44, height: 44)
            }
            Spacer()
        }
    }

    // MARK: - Actions

    private func submitSignIn() {
        focusedField = nil
        Task { await auth.signIn(email: email, password: password) }
    }

    private func submitSignUp() {
        focusedField = nil
        Task { await auth.signUp(email: email, password: password) }
    }

    private func submitSendEmailCode() {
        focusedField = nil
        Task {
            await auth.signInWithOTP(email: email)
            if auth.errorMessage == nil { codeSent = true }
        }
    }

    private func submitVerifyEmailCode() {
        focusedField = nil
        Task { await auth.verifyOTP(email: email, token: code) }
    }

    private func submitSendPhoneCode() {
        focusedField = nil
        let formatted = formatPhone(phone)
        guard formatted.count >= 8 else {
            auth.errorMessage = "Please enter a valid mobile number."
            return
        }
        phone = formatted
        Task {
            await auth.signInWithPhone(phone: formatted)
            if auth.errorMessage == nil {
                mode = .phoneVerify
                code = ""
            }
        }
    }

    private func submitVerifyPhoneCode() {
        focusedField = nil
        Task {
            await auth.verifyPhoneOTP(phone: phone, token: code)
            if auth.errorMessage == nil {
                // Persist for "Login" mode pre-fill on next visit.
                try? FlynnKeychain.set(phone, for: Self.lastPhoneKey)
            }
        }
    }

    private func loadStoredPhone() {
        if let stored = FlynnKeychain.string(for: Self.lastPhoneKey) {
            phone = stored
        }
    }

    private func formatPhone(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: " ", with: "")
        if trimmed.isEmpty { return "" }
        if trimmed.hasPrefix("+") { return trimmed }
        // Default to AU country code for local numbers
        let stripped = trimmed.hasPrefix("0") ? String(trimmed.dropFirst()) : trimmed
        return "+61\(stripped)"
    }
}
