import UIKit

/// Flynn's custom keyboard. Flow (fewest taps possible): the user copies a
/// message, switches to this keyboard, and it AUTO-DRAFTS from the clipboard on
/// appear — no "Draft a reply" tap. It shows one full reply at a time; swipe or
/// tap ‹ › to move through the options, tap the card to insert, switch back to send.
///
/// Constraints honoured here:
///  - UIKit code-only, minimal allocations (keyboard extensions are ~30-60MB capped).
///  - Works without Full Access in a non-inert fallback state (App Review 4.4).
///  - Reads the clipboard only when its `changeCount` shows new content (one paste
///    banner per copied message, never on idle re-appears).
final class KeyboardViewController: UIInputViewController {

    private let container = UIStackView()
    private let titleLabel = UILabel()
    private let redraftButton = UIButton(type: .system)
    private let nextKeyboardButton = UIButton(type: .system)

    // Results (the swipeable single-reply card + pager)
    private let card = UIControl()
    private let draftLabel = UILabel()
    private let hintLabel = UILabel()
    private let pager = UIStackView()
    private let prevButton = UIButton(type: .system)
    private let nextButton = UIButton(type: .system)
    private let pageLabel = UILabel()

    // Non-results states
    private let statusLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)

    private var drafts: [String] = []
    private var index = 0
    private var lastChangeCount = -1
    private var isDrafting = false
    private var heightConstraint: NSLayoutConstraint?

    private static let flynnOrange = UIColor(red: 0.984, green: 0.357, blue: 0.118, alpha: 1) // #FB5B1E

    // MARK: Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        SharedStore.stampKeyboardHeartbeat()
        buildUI()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        nextKeyboardButton.isHidden = !needsInputModeSwitchKey
        titleLabel.text = SharedStore.businessName.map { "Flynn · \($0)" } ?? "Flynn"
        maybeAutoDraft()
    }

    override func updateViewConstraints() {
        super.updateViewConstraints()
        if heightConstraint == nil {
            let h = view.heightAnchor.constraint(equalToConstant: 300)
            h.priority = .defaultHigh
            h.isActive = true
            heightConstraint = h
        }
    }

    // MARK: UI

    private func buildUI() {
        view.backgroundColor = .secondarySystemBackground

        container.axis = .vertical
        container.spacing = 8
        container.layoutMargins = UIEdgeInsets(top: 10, left: 14, bottom: 12, right: 14)
        container.isLayoutMarginsRelativeArrangement = true
        container.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(container)
        NSLayoutConstraint.activate([
            container.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            container.topAnchor.constraint(equalTo: view.topAnchor),
            container.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor)
        ])

        // Header: title · Redraft · globe
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.textColor = .secondaryLabel

        redraftButton.setTitle("↻ Redraft", for: .normal)
        redraftButton.titleLabel?.font = .systemFont(ofSize: 13, weight: .medium)
        redraftButton.tintColor = Self.flynnOrange
        redraftButton.addTarget(self, action: #selector(onRedraft), for: .touchUpInside)

        nextKeyboardButton.setTitle("🌐", for: .normal)
        nextKeyboardButton.titleLabel?.font = .systemFont(ofSize: 18)
        nextKeyboardButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)

        let header = UIStackView(arrangedSubviews: [titleLabel, UIView(), redraftButton, nextKeyboardButton])
        header.axis = .horizontal; header.alignment = .center; header.spacing = 10
        container.addArrangedSubview(header)

        // Card: one full reply, tap to insert, swipe to navigate.
        card.backgroundColor = .tertiarySystemBackground
        card.layer.cornerRadius = 16
        card.translatesAutoresizingMaskIntoConstraints = false

        draftLabel.numberOfLines = 0
        draftLabel.font = .systemFont(ofSize: 17)
        draftLabel.textColor = .label
        draftLabel.translatesAutoresizingMaskIntoConstraints = false
        draftLabel.isUserInteractionEnabled = false

        hintLabel.text = "Tap to insert →"
        hintLabel.font = .systemFont(ofSize: 11, weight: .semibold)
        hintLabel.textColor = Self.flynnOrange
        hintLabel.translatesAutoresizingMaskIntoConstraints = false
        hintLabel.isUserInteractionEnabled = false

        card.addSubview(draftLabel)
        card.addSubview(hintLabel)
        NSLayoutConstraint.activate([
            draftLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
            draftLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            draftLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            hintLabel.topAnchor.constraint(greaterThanOrEqualTo: draftLabel.bottomAnchor, constant: 8),
            hintLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            hintLabel.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -10),
            card.heightAnchor.constraint(greaterThanOrEqualToConstant: 132)
        ])
        card.addTarget(self, action: #selector(onInsert), for: .touchUpInside)
        let swipeLeft = UISwipeGestureRecognizer(target: self, action: #selector(onNext)); swipeLeft.direction = .left
        let swipeRight = UISwipeGestureRecognizer(target: self, action: #selector(onPrev)); swipeRight.direction = .right
        card.addGestureRecognizer(swipeLeft)
        card.addGestureRecognizer(swipeRight)
        container.addArrangedSubview(card)

        // Pager: ‹  1 / 4  ›
        prevButton.setTitle("‹", for: .normal)
        prevButton.titleLabel?.font = .systemFont(ofSize: 28, weight: .medium)
        prevButton.addTarget(self, action: #selector(onPrev), for: .touchUpInside)
        nextButton.setTitle("›", for: .normal)
        nextButton.titleLabel?.font = .systemFont(ofSize: 28, weight: .medium)
        nextButton.addTarget(self, action: #selector(onNext), for: .touchUpInside)
        pageLabel.font = .systemFont(ofSize: 13, weight: .medium)
        pageLabel.textColor = .secondaryLabel
        pageLabel.textAlignment = .center
        pageLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 60).isActive = true
        pager.axis = .horizontal; pager.alignment = .center; pager.spacing = 24
        pager.addArrangedSubview(prevButton)
        pager.addArrangedSubview(pageLabel)
        pager.addArrangedSubview(nextButton)
        let pagerWrap = UIStackView(arrangedSubviews: [UIView(), pager, UIView()])
        pagerWrap.axis = .horizontal
        container.addArrangedSubview(pagerWrap)

        // Status + spinner (loading / access / empty states)
        statusLabel.font = .systemFont(ofSize: 14)
        statusLabel.textColor = .secondaryLabel
        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        container.addArrangedSubview(statusLabel)

        spinner.hidesWhenStopped = true
        container.addArrangedSubview(spinner)
    }

    // MARK: State helpers

    private func showResults() {
        card.isHidden = false
        pager.superview?.isHidden = drafts.count <= 1
        statusLabel.isHidden = true
    }

    private func showStatus(_ text: String) {
        statusLabel.text = text
        statusLabel.isHidden = false
        card.isHidden = true
        pager.superview?.isHidden = true
    }

    private func renderCard() {
        guard drafts.indices.contains(index) else { return }
        draftLabel.text = drafts[index]
        pageLabel.text = "\(index + 1) / \(drafts.count)"
        prevButton.isEnabled = index > 0
        nextButton.isEnabled = index < drafts.count - 1
        prevButton.alpha = prevButton.isEnabled ? 1 : 0.3
        nextButton.alpha = nextButton.isEnabled ? 1 : 0.3
    }

    // MARK: Drafting

    /// Draft automatically on appear, but only when the clipboard has genuinely new
    /// content (changeCount) — otherwise keep showing the drafts we already have.
    private func maybeAutoDraft() {
        guard hasFullAccess else {
            showStatus("Turn on Full Access for Flynn in Settings → General → Keyboard so it can draft from your copied message.")
            return
        }
        guard SharedSecureStore.keyboardToken != nil else {
            showStatus("Open the Flynn app once to finish setup, then come back here.")
            return
        }
        if isDrafting { return }
        let cc = UIPasteboard.general.changeCount
        if cc == lastChangeCount && !drafts.isEmpty {
            showResults(); renderCard(); return     // nothing new copied — keep current drafts
        }
        draftFromClipboard()
    }

    private func draftFromClipboard() {
        guard hasFullAccess else { maybeAutoDraft(); return }

        // Reading the pasteboard triggers the system paste banner — expected, and
        // gated to "the clipboard changed" so it doesn't fire on idle re-appears.
        lastChangeCount = UIPasteboard.general.changeCount
        let copied = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let copied, !copied.isEmpty else {
            showStatus("Copy a message first, then tap ↻ Redraft.")
            return
        }

        let messages = SharedStore.appendCopiedMessage(copied)
        isDrafting = true
        showStatus("Drafting in your voice…")
        spinner.startAnimating()

        Task { @MainActor in
            defer { spinner.stopAnimating(); isDrafting = false }
            do {
                let result = try await KeyboardDraftClient.fetchDrafts(messages: messages)
                if result.isEmpty {
                    showStatus("Couldn't draft anything — tap ↻ Redraft to try again.")
                } else {
                    drafts = result
                    index = 0
                    renderCard()
                    showResults()
                }
            } catch KeyboardDraftClient.ClientError.notConfigured {
                showStatus("Open the Flynn app once to finish setup.")
            } catch KeyboardDraftClient.ClientError.limitReached {
                showStatus("You're out of free drafts today — open Flynn to go unlimited.")
            } catch {
                showStatus("Network hiccup — tap ↻ Redraft to try again.")
            }
        }
    }

    // MARK: Actions

    @objc private func onRedraft() {
        drafts = []
        draftFromClipboard()
    }

    @objc private func onNext() {
        guard index < drafts.count - 1 else { return }
        index += 1
        renderCard()
    }

    @objc private func onPrev() {
        guard index > 0 else { return }
        index -= 1
        renderCard()
    }

    @objc private func onInsert() {
        guard drafts.indices.contains(index) else { return }
        let draft = drafts[index]
        textDocumentProxy.insertText(draft)
        KeyboardDraftClient.recordAccepted(text: draft)
        SharedStore.resetThread()
        drafts = []
        showStatus("Inserted ✓  — switch back to send.")
    }
}
