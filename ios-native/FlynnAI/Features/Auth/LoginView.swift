import SwiftUI

struct LoginView: View {
    enum Mode {
        case landing
        case textLink       // "text me a sign-in link" (phone entry, no OTP)
        case emailPicker    // login: choose code vs password
        case emailPassword  // login with password
        case emailCode      // login with email OTP
        case signup         // new account
    }

    enum Field: Hashable {
        case email, password, code, businessName, phone
    }

    @Environment(AuthStore.self) private var auth
    @Environment(\.openURL) private var openURL

    @State private var mode: Mode = .landing
    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    @State private var businessName = ""
    @State private var phone = ""
    @State private var linkSent = false
    @State private var codeSent = false
    @FocusState private var focusedField: Field?

    var body: some View {
        ScrollView {
            VStack(spacing: FlynnSpacing.xl) {
                switch mode {
                case .landing:       landingBody
                case .textLink:      textLinkBody
                case .emailPicker:   emailPickerBody
                case .emailPassword: emailPasswordBody
                case .emailCode:     emailCodeBody
                case .signup:        signupBody
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

    // MARK: - Landing

    private var landingBody: some View {
        VStack(spacing: FlynnSpacing.lg) {
            Spacer(minLength: FlynnSpacing.xl)

            Mascot(.wave, size: 96)

            VStack(spacing: FlynnSpacing.sm) {
                HStack(spacing: 0) {
                    Text("Flynn")
                        .flynnType(FlynnTypography.displayLarge)
                        .foregroundColor(FlynnColor.textPrimary)
                    Text(".ai")
                        .flynnType(FlynnTypography.displayLarge)
                        .foregroundColor(FlynnColor.primary)
                }
                Text("Run your business\nfrom your messages.")
                    .flynnType(FlynnTypography.displayMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                    .multilineTextAlignment(.center)
                Text("Text Flynn like a mate who knows your business. It handles the admin and learns as you go.")
                    .flynnType(FlynnTypography.bodyLarge)
                    .foregroundColor(FlynnColor.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, FlynnSpacing.md)
            }

            Spacer(minLength: FlynnSpacing.xl)

            // Primary: open iMessage to Flynn and start texting (the real onboarding).
            FlynnButton(
                title: "Message Flynn to get started",
                action: openMessageFlynn,
                fullWidth: true
            )

            // Secondary: already texted Flynn — get a one-tap sign-in link, no code to type.
            Button(action: { mode = .textLink; linkSent = false }) {
                Text("Already texted Flynn? Sign in")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.primary)
                    .fontWeight(.bold)
            }

            Button(action: { mode = .emailPicker }) {
                Text("Use email instead")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
            }

            Text("By continuing, you accept our Terms & Privacy Policy.")
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
                .multilineTextAlignment(.center)
                .padding(.top, FlynnSpacing.xs)
        }
    }

    // MARK: - Text-link sign-in (no OTP)

    private var textLinkBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            backRow
            Mascot(.peek, size: 72)
                .padding(.bottom, FlynnSpacing.xs)
            Text("Sign in")
                .flynnType(FlynnTypography.displayMedium)
                .foregroundColor(FlynnColor.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            if linkSent {
                Text("Sent. Open the link Flynn just texted you and you're in — no code to type.")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.success)
                    .multilineTextAlignment(.center)
                    .padding(FlynnSpacing.sm)
                    .background(FlynnColor.successLight)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                FlynnButton(title: "Send again", action: submitSendTextLink, variant: .secondary, fullWidth: true, isLoading: auth.isSubmitting)
            } else {
                Text("Enter the number you text Flynn from. We'll text you a link that opens the app already signed in.")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                FlynnTextField(
                    label: "Mobile number",
                    text: $phone,
                    placeholder: "+61 4XX XXX XXX",
                    keyboardType: .phonePad,
                    textContentType: .telephoneNumber,
                    submitLabel: .send,
                    onSubmit: submitSendTextLink
                )
                .focused($focusedField, equals: .phone)
                FlynnButton(title: "Text me a sign-in link", action: submitSendTextLink, fullWidth: true, isLoading: auth.isSubmitting)
            }
        }
    }

    // MARK: - Email picker (login options)

    private var emailPickerBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            backRow
            Mascot(.peek, size: 72)
                .padding(.bottom, FlynnSpacing.xs)
            Text("Welcome back")
                .flynnType(FlynnTypography.displayMedium)
                .foregroundColor(FlynnColor.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            FlynnButton(title: "Email code (no password)", action: { mode = .emailCode }, variant: .secondary, fullWidth: true)
            FlynnButton(title: "Email & password", action: { mode = .emailPassword }, variant: .secondary, fullWidth: true)
            HStack(spacing: 4) {
                Text("New here?")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textSecondary)
                Button("Create an account") { mode = .signup }
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.primary)
                    .fontWeight(.bold)
            }
            .padding(.top, FlynnSpacing.md)
        }
    }

    // MARK: - Email + password (login)

    private var emailPasswordBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            backRow
            Mascot(.peek, size: 72)
                .padding(.bottom, FlynnSpacing.xs)
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

    // MARK: - Email OTP (login)

    private var emailCodeBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            backRow
            Mascot(.thinking, size: 72)
                .padding(.bottom, FlynnSpacing.xs)
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
            Mascot(.thumbsup, size: 72)
                .padding(.bottom, FlynnSpacing.xs)
            Text("Create account")
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

    // MARK: - Back row

    private var backRow: some View {
        HStack {
            Button(action: { mode = .landing; codeSent = false; code = ""; linkSent = false }) {
                Image(systemName: "arrow.left")
                    .font(.title2)
                    .foregroundColor(FlynnColor.textPrimary)
                    .frame(width: 44, height: 44)
            }
            Spacer()
        }
    }

    // MARK: - Actions

    /// Opens iMessage to Flynn with a starter message — texting Flynn IS the onboarding.
    private func openMessageFlynn() {
        let number = FlynnEnv.flynnContactNumber
        let body = "Hi Flynn".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "Hi%20Flynn"
        if let url = URL(string: "sms:\(number)&body=\(body)") {
            openURL(url)
        }
    }

    private func submitSendTextLink() {
        focusedField = nil
        Task {
            let ok = await auth.requestAppLink(phone: phone)
            if ok { linkSent = true }
        }
    }

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
}
