import SwiftUI
import Supabase

// MARK: - Step 1: Website scrape (stub)

struct WebsiteScrapeStepView: View {
    @Environment(FlashStore.self) private var flash
    @State private var url: String = ""
    @State private var isSubmitting = false
    let onContinue: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                stepHeader(
                    eyebrow: "Step 1 of 5",
                    title: "Tell Flynn about your business",
                    subtitle: "We'll pull your services and tone from your website so your IVR sounds like you."
                )

                FlynnTextField(
                    label: "Website",
                    text: $url,
                    placeholder: "https://yourtradiebusiness.com.au",
                    textContentType: .URL,
                    autocapitalization: .never
                )

                FlynnButton(
                    title: "Continue",
                    action: submit,
                    fullWidth: true,
                    isLoading: isSubmitting
                )

                Button("I don't have a website") { onContinue() }
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
                    .frame(maxWidth: .infinity)
            }
            .padding(FlynnSpacing.lg)
        }
    }

    private func submit() {
        guard !url.isEmpty else { onContinue(); return }
        isSubmitting = true
        Task {
            // Record the URL on the users row so a future scrape worker can pick it up.
            struct Patch: Encodable { let website_url: String? }
            do {
                let session = try await FlynnSupabase.client.auth.session
                try await FlynnSupabase.client
                    .from("business_profiles")
                    .upsert(
                        ["user_id": session.user.id.uuidString, "website_url": url],
                        onConflict: "user_id"
                    )
                    .execute()
                flash.success("Saved")
            } catch {
                flash.error("Couldn't save website")
            }
            isSubmitting = false
            onContinue()
        }
    }
}

// MARK: - Step 2: Mode selector

struct CallHandlingModeStepView: View {
    let onContinue: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            stepHeader(
                eyebrow: "Step 2 of 5",
                title: "How should Flynn handle missed calls?",
                subtitle: "Start with SMS Links — it's free to run. You can switch to AI any time."
            )
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.top, FlynnSpacing.lg)

            CallModeSelectorView()

            FlynnButton(
                title: "Continue",
                action: onContinue,
                fullWidth: true
            )
            .padding(FlynnSpacing.lg)
        }
    }
}

// MARK: - Step 3: IVR script

struct IvrScriptStepView: View {
    let onContinue: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            stepHeader(
                eyebrow: "Step 3 of 5",
                title: "Pick an IVR template",
                subtitle: "This is what callers hear when Flynn answers. You can tweak it later."
            )
            .padding(.horizontal, FlynnSpacing.lg)
            .padding(.top, FlynnSpacing.lg)

            IVRScriptEditorView()

            FlynnButton(
                title: "Continue",
                action: onContinue,
                fullWidth: true
            )
            .padding(FlynnSpacing.lg)
        }
    }
}

// MARK: - Step 4: Forwarding

struct ForwardingStepView: View {
    let onContinue: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForwardingSetupView()
            FlynnButton(
                title: "I've set up forwarding",
                action: onContinue,
                fullWidth: true
            )
            .padding(FlynnSpacing.lg)
        }
    }
}

// MARK: - Step 5: Test call

struct TestCallStepView: View {
    @Environment(FlashStore.self) private var flash
    let onFinish: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                stepHeader(
                    eyebrow: "Step 5 of 5",
                    title: "Make a test call",
                    subtitle: "Grab a second phone and dial your regular mobile. Let it ring out — Flynn should answer."
                )

                VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                    Label("Caller should press 1 or 2", systemImage: "1.circle.fill")
                        .flynnType(FlynnTypography.bodyMedium)
                    Label("You'll receive an SMS on that phone within 2 seconds", systemImage: "message.fill")
                        .flynnType(FlynnTypography.bodyMedium)
                    Label("The call appears in your Calls tab", systemImage: "phone.fill")
                        .flynnType(FlynnTypography.bodyMedium)
                }
                .foregroundColor(FlynnColor.textSecondary)
                .padding(FlynnSpacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                        .fill(FlynnColor.backgroundSecondary)
                )
                .brutalistBorder(cornerRadius: FlynnRadii.md)

                FlynnButton(
                    title: "All done — take me to Flynn",
                    action: onFinish,
                    fullWidth: true
                )
            }
            .padding(FlynnSpacing.lg)
        }
    }
}

// MARK: - Shared header

@MainActor
@ViewBuilder
private func stepHeader(eyebrow: String, title: String, subtitle: String) -> some View {
    VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
        Text(eyebrow)
            .flynnType(FlynnTypography.overline)
            .foregroundColor(FlynnColor.textTertiary)
        Text(title)
            .flynnType(FlynnTypography.h2)
            .foregroundColor(FlynnColor.textPrimary)
        Text(subtitle)
            .flynnType(FlynnTypography.bodyMedium)
            .foregroundColor(FlynnColor.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
}
