import SwiftUI

struct LoginView: View {
    enum Mode {
        case landing
        case phoneCode      // sign in with phone OTP — lands on your text-agent account
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
                case .phoneCode:     phoneCodeBody
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
                        .clipShape(RoundedRectangle(cornerRadius: FlynnRadii.sm))
                }
                if mode == .signup, auth.awaitingEmailConfirmation {
                    Text("Check your email — we sent a confirmation link to \(email). Tap it to finish signing up.")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.success)
                        .multilineTextAlignment(.center)
                        .padding(FlynnSpacing.sm)
                        .background(FlynnColor.successLight)
                        .clipShape(RoundedRectangle(cornerRadius: FlynnRadii.sm))
                }
            }
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.vertical, FlynnSpacing.xxl)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(FlynnColor.background)
    }

    // MARK: - Landing

    /// First run.
    ///
    /// Almost everyone landing here has just hung up from the ad line and been
    /// texted a link — so there is exactly one thing to do: confirm the number
    /// they rang from. Phone-matching is what pulls their staged receptionist
    /// config through, so the screen says so rather than leaving them hunting
    /// for somewhere to type the setup code from the text.
    private var landingBody: some View {
        VStack(spacing: FlynnSpacing.lg) {
            Spacer(minLength: FlynnSpacing.lg)

            Mascot(.wave, size: 104)

            VStack(spacing: FlynnSpacing.sm) {
                Text("Flynn")
                    .flynnType(FlynnTypography.displayLarge)
                    .foregroundColor(FlynnColor.textPrimary)
                Text("Never miss\nanother job.")
                    .flynnType(FlynnTypography.displayMedium)
                    .foregroundColor(FlynnColor.textPrimary)
                    .multilineTextAlignment(.center)
                Text("Flynn answers the calls you can't take, books the job, and texts the client back in seconds.")
                    .flynnType(FlynnTypography.bodyLarge)
                    .foregroundColor(FlynnColor.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, FlynnSpacing.md)
            }

            Spacer(minLength: FlynnSpacing.lg)

            VStack(spacing: FlynnSpacing.sm) {
                FlynnGlassButton(
                    title: "Continue with my mobile",
                    action: { mode = .phoneCode; codeSent = false; code = "" },
                    icon: Image(systemName: "iphone")
                )

                Text("Just spoke to Flynn? Use that same number and everything you told her is already waiting.")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, FlynnSpacing.xs)
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

    // MARK: - Phone OTP sign-in (lands on your text-agent account)

    /// Two beats, one question each — never both fields on screen at once.
    ///
    /// The funnel texts people a 6-CHARACTER setup code, and Supabase texts a
    /// 6-DIGIT sign-in code. Two different codes arriving minutes apart is the
    /// single most confusing thing about this flow, so the code step names which
    /// one it wants and says where the other one goes.
    private var phoneCodeBody: some View {
        VStack(spacing: FlynnSpacing.md) {
            backRow
            Mascot(codeSent ? .peek : .wave, size: 72)
                .padding(.bottom, FlynnSpacing.xs)

            Text(codeSent ? "Check your texts" : "What's your mobile?")
                .flynnType(FlynnTypography.displayMedium)
                .foregroundColor(FlynnColor.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(codeSent
                 ? "We sent a 6-digit code to \(e164Phone)."
                 : "Use the number you rang Flynn from, and the business details you gave her come across automatically.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            if codeSent {
                FlynnTextField(
                    label: "6-digit sign-in code",
                    text: $code,
                    placeholder: "000000",
                    keyboardType: .numberPad,
                    textContentType: .oneTimeCode,
                    submitLabel: .done,
                    helperText: "Not your setup code — Flynn only asks for that if she can't match your number.",
                    onSubmit: submitVerifyPhoneCode
                )
                .focused($focusedField, equals: .code)
                .onChange(of: code) { _, newValue in
                    // Trim to 6 and verify the moment it's complete: nobody
                    // should have to reach for a button after typing a code.
                    let digits = String(newValue.filter(\.isNumber).prefix(6))
                    if digits != newValue { code = digits }
                    if digits.count == 6, !auth.isSubmitting { submitVerifyPhoneCode() }
                }
            } else {
                FlynnTextField(
                    label: "Mobile number",
                    text: $phone,
                    placeholder: "04XX XXX XXX",
                    keyboardType: .phonePad,
                    textContentType: .telephoneNumber,
                    submitLabel: .send,
                    onSubmit: submitSendPhoneCode
                )
                .focused($focusedField, equals: .phone)
            }

            FlynnGlassButton(
                title: codeSent ? "Verify & sign in" : "Send me a code",
                action: codeSent ? submitVerifyPhoneCode : submitSendPhoneCode,
                isLoading: auth.isSubmitting,
                isDisabled: codeSent ? code.count < 6 : phone.filter(\.isNumber).count < 8
            )

            if codeSent {
                HStack(spacing: FlynnSpacing.md) {
                    Button(action: submitSendPhoneCode) {
                        Text("Send again")
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                    Text("·")
                        .foregroundColor(FlynnColor.textTertiary)
                    Button(action: { codeSent = false; code = ""; focusedField = .phone }) {
                        Text("Change number")
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity)
            } else {
                // Fallback for anyone who'd rather tap a link than type a code.
                Button(action: { mode = .textLink; linkSent = false }) {
                    Text("Text me a sign-in link instead")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .animation(.snappy(duration: 0.28), value: codeSent)
        .onAppear {
            // Straight into typing — this screen exists to be filled in.
            if !codeSent, phone.isEmpty { focusedField = .phone }
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
                    .clipShape(RoundedRectangle(cornerRadius: FlynnRadii.sm))
                FlynnGlassButton(title: "Send again", action: submitSendTextLink, variant: .neutral, isLoading: auth.isSubmitting)
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
                FlynnGlassButton(title: "Text me a sign-in link", action: submitSendTextLink, isLoading: auth.isSubmitting)
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
            FlynnGlassButton(title: "Email code (no password)", action: { mode = .emailCode }, variant: .neutral)
            FlynnGlassButton(title: "Email & password", action: { mode = .emailPassword }, variant: .neutral)
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
            FlynnGlassButton(title: "Log in", action: submitSignIn, isLoading: auth.isSubmitting)
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

            FlynnGlassButton(
                title: codeSent ? "Verify code" : "Send login code",
                action: codeSent ? submitVerifyEmailCode : submitSendEmailCode,
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
            FlynnGlassButton(title: "Sign up", action: submitSignUp, isLoading: auth.isSubmitting)
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

    /// Normalise the typed number to E.164 so Supabase matches the SAME auth user
    /// the backend created when this number first texted Flynn (AU/NZ-aware, mirrors
    /// the server's `normalizePhone`). Without this, "04…" wouldn't match "+61…" and
    /// the user would land on a fresh, empty account.
    private var e164Phone: String {
        let raw = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        let digits = raw.filter(\.isNumber)
        guard !digits.isEmpty else { return raw }
        if raw.hasPrefix("+") { return "+" + digits }
        if digits.hasPrefix("61") && digits.count == 11 { return "+" + digits }
        if digits.hasPrefix("0") && digits.count == 10 { return "+61" + digits.dropFirst() }
        if digits.hasPrefix("64") { return "+" + digits }
        return "+" + digits
    }

    private func submitSendPhoneCode() {
        focusedField = nil
        Task {
            await auth.signInWithPhone(phone: e164Phone)
            if auth.errorMessage == nil {
                codeSent = true
                focusedField = .code
            }
        }
    }

    private func submitVerifyPhoneCode() {
        focusedField = nil
        Task { await auth.verifyPhoneOTP(phone: e164Phone, token: code) }
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
