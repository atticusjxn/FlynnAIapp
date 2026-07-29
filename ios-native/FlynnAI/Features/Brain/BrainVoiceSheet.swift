import SwiftUI

/// "Here's what I heard." The whole point of this screen is that nothing is
/// written until the user has seen it and can fix the one thing that's wrong —
/// a misheard price would otherwise poison every quote Flynn ever writes.
struct BrainVoiceSheet: View {
    @Environment(\.dismiss) private var dismiss

    let transcript: String
    @State var proposals: [BrainVoiceFill.Proposal]
    /// Only the accepted proposals, in their edited form.
    let onApply: ([BrainVoiceFill.Proposal]) -> Void

    @State private var editing: BrainVoiceFill.Proposal.ID?

    private var acceptedCount: Int { proposals.filter(\.accepted).count }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                    heardCard

                    Text("Tap anything to fix it. Untick what Flynn got wrong.")
                        .flynnType(FlynnTypography.bodySmall)
                        .foregroundColor(FlynnColor.textSecondary)

                    ForEach($proposals) { $proposal in
                        proposalRow($proposal)
                    }
                }
                .padding(.horizontal, FlynnSpacing.lg)
                .padding(.vertical, FlynnSpacing.md)
            }
            .background(FlynnColor.background)
            .navigationTitle("What Flynn heard")
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: FlynnSpacing.xs) {
                    FlynnButton(
                        title: acceptedCount == 0 ? "Nothing selected" : "Add \(acceptedCount) to Brain",
                        action: {
                            onApply(proposals.filter(\.accepted))
                            dismiss()
                        },
                        fullWidth: true,
                        isDisabled: acceptedCount == 0
                    )
                    Button("Discard") { dismiss() }
                        .flynnType(FlynnTypography.label)
                        .foregroundColor(FlynnColor.textTertiary)
                        .frame(minHeight: 44)
                }
                .padding(.horizontal, FlynnSpacing.lg)
                .padding(.top, FlynnSpacing.sm)
                .padding(.bottom, FlynnSpacing.xs)
                .background(FlynnColor.background.ignoresSafeArea(edges: .bottom))
            }
        }
    }

    private var heardCard: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
            Text("You said")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text(transcript)
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flynnCardSurface(.quiet)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func proposalRow(_ proposal: Binding<BrainVoiceFill.Proposal>) -> some View {
        let p = proposal.wrappedValue
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            HStack(spacing: FlynnSpacing.sm) {
                Image(systemName: p.field.systemImage)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(p.accepted ? FlynnColor.primary : FlynnColor.textTertiary)
                    .frame(width: 24)

                Text(p.field.label)
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)

                Spacer(minLength: 0)

                Button {
                    proposal.wrappedValue.accepted.toggle()
                } label: {
                    Image(systemName: p.accepted ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 22))
                        .foregroundColor(p.accepted ? FlynnColor.success : FlynnColor.textTertiary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(p.accepted ? "Included" : "Excluded")
                .accessibilityHint("Toggles whether this is added to your Brain")
            }

            // Editable in place — correcting a misheard price shouldn't mean
            // discarding the whole batch and starting again.
            TextField(p.field.label, text: proposal.value, axis: .vertical)
                .flynnType(FlynnTypography.bodyLarge)
                .foregroundColor(p.accepted ? FlynnColor.textPrimary : FlynnColor.textTertiary)
                .lineLimit(1...4)
                .disabled(!p.accepted)

            if let detail = p.detail, !detail.isEmpty {
                Text(detail)
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            }
        }
        .padding(FlynnSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .flynnCardSurface(p.accepted ? .raised : .quiet)
        .opacity(p.accepted ? 1 : 0.6)
        .animation(.easeOut(duration: 0.15), value: p.accepted)
    }
}
