import SwiftUI
import AppKit

/// The SwiftUI content of the floating draft popup.
///
/// Layout:
///   ┌─ header: Flynn · AppName ────── ↻ ─┐
///   │  draft card (← text 1/3 →)         │
///   │─────────────────────────────────────│
///   │  ↵ Insert  ·  E Edit  ·  Esc       │
///   └─────────────────────────────────────┘
struct DraftPopupView: View {
    @State var viewModel: DraftPopupViewModel
    @State private var editText: String = ""
    @FocusState private var editFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            headerRow
            Divider().overlay(FlynnColor.border)
            contentArea
            Divider().overlay(FlynnColor.border)
            hintBar
        }
        .background(FlynnColor.cream)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(FlynnColor.border, lineWidth: 2)
        )
        .shadow(color: FlynnColor.black.opacity(0.15), radius: 16, x: 0, y: 8)
        .onKeyboardShortcut(.escape, modifiers: []) { viewModel.dismiss() }
        .onKeyboardShortcut(.return, modifiers: []) { handleReturn() }
        .onKeyboardShortcut("e", modifiers: []) { handleEdit() }
        .onKeyboardShortcut(.leftArrow, modifiers: []) { viewModel.selectPrevious() }
        .onKeyboardShortcut(.rightArrow, modifiers: []) { viewModel.selectNext() }
    }

    // MARK: - Header

    private var headerRow: some View {
        HStack(spacing: FlynnSpacing.xs) {
            // Flynn mascot dot
            Circle()
                .fill(FlynnColor.primary)
                .frame(width: 8, height: 8)

            Text("Flynn")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(FlynnColor.textPrimary)

            Text("·")
                .foregroundColor(FlynnColor.textTertiary)

            Text(viewModel.appName)
                .font(.system(size: 12, weight: .regular))
                .foregroundColor(FlynnColor.textSecondary)
                .lineLimit(1)

            Spacer()

            // Redraft button
            if case .ready = viewModel.state {
                Button(action: viewModel.redraft) {
                    HStack(spacing: 3) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 10))
                        Text("Redraft")
                            .font(.system(size: 11))
                    }
                    .foregroundColor(FlynnColor.primary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, FlynnSpacing.md)
        .padding(.vertical, FlynnSpacing.sm)
    }

    // MARK: - Content

    @ViewBuilder
    private var contentArea: some View {
        switch viewModel.state {
        case .idle:
            EmptyView()

        case .loading:
            DraftCardSkeleton()
                .padding(FlynnSpacing.md)

        case .ready(let drafts):
            DraftCard(
                text: drafts[viewModel.selectedIndex],
                index: viewModel.selectedIndex,
                total: drafts.count,
                isSelected: true,
                onInsert: viewModel.insertSelected,
                onPrev: viewModel.selectPrevious,
                onNext: viewModel.selectNext
            )
            .padding(FlynnSpacing.md)

        case .editing(let draft, _):
            TextEditor(text: $editText)
                .font(.system(size: 15))
                .foregroundColor(FlynnColor.textPrimary)
                .scrollContentBackground(.hidden)
                .background(FlynnColor.creamCard)
                .frame(minHeight: 80, maxHeight: 140)
                .padding(FlynnSpacing.md)
                .focused($editFocused)
                .onAppear {
                    editText = draft
                    editFocused = true
                }

        case .error(let msg):
            VStack(spacing: FlynnSpacing.xs) {
                Image(systemName: "exclamationmark.triangle")
                    .foregroundColor(FlynnColor.warning)
                Text(msg)
                    .font(.system(size: 13))
                    .foregroundColor(FlynnColor.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(FlynnSpacing.lg)

        case .permissionNeeded:
            VStack(spacing: FlynnSpacing.sm) {
                Image(systemName: "lock.shield")
                    .font(.system(size: 24))
                    .foregroundColor(FlynnColor.primary)
                Text("Accessibility access needed")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(FlynnColor.textPrimary)
                Text("System Settings → Privacy & Security → Accessibility → add Flynn")
                    .font(.system(size: 12))
                    .foregroundColor(FlynnColor.textSecondary)
                    .multilineTextAlignment(.center)
                HStack(spacing: FlynnSpacing.xs) {
                    Button("Open Settings") {
                        AccessibilityPermission.openSystemSettings()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(FlynnColor.primary)
                    .font(.system(size: 12))

                    Button("Check again") {
                        viewModel.retryPermission()
                    }
                    .buttonStyle(.bordered)
                    .font(.system(size: 12))
                }
                .padding(.top, FlynnSpacing.xxs)
            }
            .padding(FlynnSpacing.lg)

        case .noConversation:
            VStack(spacing: FlynnSpacing.xs) {
                Image(systemName: "text.bubble")
                    .font(.system(size: 24))
                    .foregroundColor(FlynnColor.textTertiary)
                Text("No conversation found")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(FlynnColor.textPrimary)
                Text("Focus a chat window, then press your hotkey.")
                    .font(.system(size: 12))
                    .foregroundColor(FlynnColor.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(FlynnSpacing.lg)
        }
    }

    // MARK: - Hint bar

    @ViewBuilder
    private var hintBar: some View {
        switch viewModel.state {
        case .ready:
            HStack(spacing: FlynnSpacing.md) {
                hintItem(key: "↵", label: "Insert")
                hintItem(key: "E", label: "Edit")
                hintItem(key: "←→", label: "Navigate")
                hintItem(key: "Esc", label: "Close")
            }
            .padding(.horizontal, FlynnSpacing.md)
            .padding(.vertical, FlynnSpacing.xs)

        case .editing:
            HStack(spacing: FlynnSpacing.md) {
                hintItem(key: "↵", label: "Insert edited")
                hintItem(key: "Esc", label: "Cancel")
            }
            .padding(.horizontal, FlynnSpacing.md)
            .padding(.vertical, FlynnSpacing.xs)

        default:
            hintItem(key: "Esc", label: "Close")
                .padding(.horizontal, FlynnSpacing.md)
                .padding(.vertical, FlynnSpacing.xs)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    private func hintItem(key: String, label: String) -> some View {
        HStack(spacing: 3) {
            Text(key)
                .font(.system(size: 10, weight: .semibold, design: .monospaced))
                .foregroundColor(FlynnColor.textTertiary)
                .padding(.horizontal, 4)
                .padding(.vertical, 2)
                .background(FlynnColor.backgroundTertiary)
                .cornerRadius(4)
            Text(label)
                .font(.system(size: 10))
                .foregroundColor(FlynnColor.textTertiary)
        }
    }

    // MARK: - Key handlers

    private func handleReturn() {
        if case .editing = viewModel.state {
            viewModel.insertEdited(text: editText)
        } else {
            viewModel.insertSelected()
        }
    }

    private func handleEdit() {
        if case .ready = viewModel.state {
            viewModel.beginEditing()
        } else if case .editing = viewModel.state {
            viewModel.cancelEditing()
        }
    }
}

// MARK: - Keyboard shortcut helper

private extension View {
    func onKeyboardShortcut(_ key: KeyEquivalent, modifiers: EventModifiers, action: @escaping () -> Void) -> some View {
        self.keyboardShortcut(key, modifiers: modifiers)
            .background(
                Button("", action: action)
                    .keyboardShortcut(key, modifiers: modifiers)
                    .hidden()
            )
    }
}
