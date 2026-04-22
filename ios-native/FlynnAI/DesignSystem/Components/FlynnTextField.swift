import SwiftUI

struct FlynnTextField: View {
    let label: String
    @Binding var text: String
    var placeholder: String = ""
    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType? = nil
    var autocapitalization: TextInputAutocapitalization = .sentences
    var autocorrection: Bool = true
    var submitLabel: SubmitLabel = .return
    var helperText: String? = nil
    var errorText: String? = nil
    var isRequired: Bool = false
    var onSubmit: (() -> Void)? = nil

    @FocusState private var isFocused: Bool
    private var hasError: Bool { !(errorText?.isEmpty ?? true) }

    var body: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            HStack(spacing: 2) {
                Text(label)
                    .flynnType(FlynnTypography.label)
                    .foregroundColor(FlynnColor.textPrimary)
                if isRequired {
                    Text("*")
                        .flynnType(FlynnTypography.label)
                        .foregroundColor(FlynnColor.error)
                }
            }

            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .focused($isFocused)
            .flynnType(FlynnTypography.bodyLarge)
            .foregroundColor(FlynnColor.textPrimary)
            .padding(.horizontal, FlynnSpacing.md)
            .frame(height: 60)
            .keyboardType(keyboardType)
            .textContentType(textContentType)
            .textInputAutocapitalization(autocapitalization)
            .autocorrectionDisabled(!autocorrection)
            .submitLabel(submitLabel)
            .onSubmit { onSubmit?() }
            .background(
                RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                    .fill(FlynnColor.backgroundSecondary)
            )
            .brutalistBorder(
                cornerRadius: FlynnRadii.md,
                color: hasError
                    ? FlynnColor.borderError
                    : (isFocused ? FlynnColor.borderFocus : FlynnColor.border),
                lineWidth: 2
            )
            .brutalistShadow(isFocused ? .sm : .xs, cornerRadius: FlynnRadii.md)
            .animation(.easeOut(duration: 0.15), value: isFocused)

            if let errorText, !errorText.isEmpty {
                Text(errorText)
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.error)
            } else if let helperText, !helperText.isEmpty {
                Text(helperText)
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            }
        }
    }
}

#Preview {
    @Previewable @State var email = ""
    @Previewable @State var password = ""

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
            isRequired: true
        )
        FlynnTextField(
            label: "Password",
            text: $password,
            placeholder: "Enter password",
            isSecure: true,
            textContentType: .password,
            submitLabel: .done
        )
    }
    .padding(FlynnSpacing.lg)
    .background(FlynnColor.background)
}
