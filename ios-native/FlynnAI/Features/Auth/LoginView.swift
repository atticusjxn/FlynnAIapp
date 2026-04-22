import SwiftUI

struct LoginView: View {
    enum Mode {
        case landing
        case emailPassword
        case emailCode
        case signup
    }

    enum Field: Hashable {
        case email, password, code, businessName
    }

    @Environment(AuthStore.self) private var auth

    @State private var mode: Mode = .landing
    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    @State private var businessName = ""
    @State private var codeSent = false
    @FocusState private var focusedField: Field?

    var body: some View {
        ScrollView {
            VStack(spacing: FlynnSpacing.xl) {
                header
                switch mode {
                case .landing: landingBody
                case .emailPassword: emailPasswordBody
                case .emailCode: emailCodeBody
                case .signup: signupBody
                }
                if let message = auth.errorMessage {
                    Text(message)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.error)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.vertical, FlynnSpacing.xxl)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(FlynnColor.background)
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: FlynnSpacing.xs) {
            if mode != .landing {
                HStack {
                    Button(action: { mode = .landing }) {
                        Image(systemName: "arrow.left")
                            .font(.title2)
                            .foregroundColor(FlynnColor.textPrimary)
                            .frame(width: 44, height: 44)
                    }
                    Spacer()
                }
            }
            Text(titleText)
                .flynnType(FlynnTypography.displayMedium)
                .multilineTextAlignment(.center)
            if let subtitle = subtitleText {
                Text(subtitle)
                    .flynnType(FlynnTypography.bodyLarge)
                    .foregroundColor(FlynnColor.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var titleText: String {
        switch mode {
        case .landing: return "Flynn.ai"
        case .emailPassword: return "Log in"
        case .emailCode: return "Log in with code"
        case .signup: return "Create account"
        }
    }

    private var subtitleText: String? {
        mode == .landing ? "The phone system for better customer service" : nil
    }

    // MARK: - Landing

    private var landingBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            FlynnButton(title: "Email & password", action: { mode = .emailPassword }, variant: .secondary, fullWidth: true)
            FlynnButton(title: "Email code", action: { mode = .emailCode }, variant: .secondary, fullWidth: true)

            HStack(spacing: FlynnSpacing.xs) {
                Text("Don't have an account yet?")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
                Button("Sign up") { mode = .signup }
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.primary)
            }
            .padding(.top, FlynnSpacing.md)
        }
    }

    // MARK: - Email + password

    private var emailPasswordBody: some View {
        VStack(spacing: FlynnSpacing.md) {
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

            FlynnButton(
                title: "Log in",
                action: submitSignIn,
                fullWidth: true,
                isLoading: auth.isSubmitting
            )
        }
    }

    // MARK: - Email code (OTP)

    private var emailCodeBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            FlynnTextField(
                label: "Email",
                text: $email,
                placeholder: "name@company.com",
                keyboardType: .emailAddress,
                textContentType: .emailAddress,
                autocapitalization: .never,
                autocorrection: false,
                submitLabel: codeSent ? .next : .send,
                onSubmit: { codeSent ? (focusedField = .code) : submitSendCode() }
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
                    onSubmit: submitVerifyCode
                )
                .focused($focusedField, equals: .code)
            }

            FlynnButton(
                title: codeSent ? "Verify code" : "Send login code",
                action: codeSent ? submitVerifyCode : submitSendCode,
                fullWidth: true,
                isLoading: auth.isSubmitting
            )
        }
    }

    // MARK: - Signup

    private var signupBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            FlynnTextField(
                label: "Business name",
                text: $businessName,
                placeholder: "Acme Corp",
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

            FlynnButton(
                title: "Sign up",
                action: submitSignUp,
                fullWidth: true,
                isLoading: auth.isSubmitting
            )
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

    private func submitSendCode() {
        focusedField = nil
        Task {
            await auth.signInWithOTP(email: email)
            if auth.errorMessage == nil { codeSent = true }
        }
    }

    private func submitVerifyCode() {
        focusedField = nil
        Task { await auth.verifyOTP(email: email, token: code) }
    }
}
