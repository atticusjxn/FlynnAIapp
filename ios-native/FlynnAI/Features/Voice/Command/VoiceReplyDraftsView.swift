import SwiftUI
import UIKit

/// Drafts Flynn composed from a spoken "message X about Y" command. Flynn never
/// sends — the user copies the one they like and pastes it where they're already
/// messaging (matches the keyboard's insert-don't-send principle).
struct VoiceReplyDraftsView: View {
    let recipient: String?
    let drafts: [String]
    let onClose: () -> Void
    var onCopied: (() -> Void)?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: FlynnSpacing.md) {
                    if let recipient, !recipient.isEmpty {
                        Text("To \(recipient)")
                            .flynnType(FlynnTypography.bodySmall)
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                    ForEach(Array(drafts.enumerated()), id: \.offset) { _, draft in
                        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                            Text(draft)
                                .flynnType(FlynnTypography.bodyMedium)
                                .foregroundColor(FlynnColor.textPrimary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            FlynnButton(title: "Copy", action: {
                                UIPasteboard.general.string = draft
                                onCopied?()
                            }, variant: .secondary, size: .small)
                        }
                        .padding(FlynnSpacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: FlynnRadii.xxl, style: .continuous)
                                .fill(FlynnColor.backgroundSecondary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: FlynnRadii.xxl, style: .continuous)
                                .strokeBorder(FlynnColor.border, lineWidth: 2)
                        )
                    }
                    if drafts.isEmpty {
                        Text("Couldn't draft anything — try again.")
                            .flynnType(FlynnTypography.bodyMedium)
                            .foregroundColor(FlynnColor.textSecondary)
                    }
                }
                .padding(FlynnSpacing.lg)
            }
            .background(FlynnColor.background.ignoresSafeArea())
            .navigationTitle("Your drafts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done", action: onClose)
                }
            }
        }
    }
}
