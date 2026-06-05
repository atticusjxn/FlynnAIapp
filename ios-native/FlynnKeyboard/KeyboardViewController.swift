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

    // Results (the swipeable single-reply card)
    // ‹ and › are embedded inside the card so the swipe affordance is always visible.
    private let card = UIControl()
    private let draftLabel = UILabel()
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

    // Where the currently-shown drafts came from ("clipboard" or "screenshot") and
    // the source messages — both sent with the pick so the backend learns by source.
    private var currentSource = "clipboard"
    private var sourceMessages: [String] = []

    private static let flynnOrange = UIColor(red: 0.984, green: 0.357, blue: 0.118, alpha: 1) // #FB5B1E
    private static let obCream     = UIColor(red: 0.957, green: 0.902, blue: 0.808, alpha: 1) // #F4E6CE
    private static let obCard      = UIColor(red: 1.000, green: 0.984, blue: 0.957, alpha: 1) // #FFFBF4
    private static let obInk       = UIColor(red: 0.173, green: 0.125, blue: 0.094, alpha: 1) // #2C2018

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
        view.backgroundColor = Self.obCream

        container.axis = .vertical
        container.spacing = 10
        container.layoutMargins = UIEdgeInsets(top: 12, left: 14, bottom: 14, right: 14)
        container.isLayoutMarginsRelativeArrangement = true
        container.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(container)
        NSLayoutConstraint.activate([
            container.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            container.topAnchor.constraint(equalTo: view.topAnchor),
            container.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor)
        ])

        // Header: Flynn · Business  ↻ Redraft  🌐
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.textColor = Self.obInk.withAlphaComponent(0.6)

        redraftButton.setTitle("↻ Redraft", for: .normal)
        redraftButton.titleLabel?.font = .systemFont(ofSize: 13, weight: .semibold)
        redraftButton.tintColor = Self.flynnOrange
        redraftButton.addTarget(self, action: #selector(onRedraft), for: .touchUpInside)

        nextKeyboardButton.setTitle("🌐", for: .normal)
        nextKeyboardButton.titleLabel?.font = .systemFont(ofSize: 18)
        nextKeyboardButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)

        let header = UIStackView(arrangedSubviews: [titleLabel, UIView(), redraftButton, nextKeyboardButton])
        header.axis = .horizontal; header.alignment = .center; header.spacing = 10
        container.addArrangedSubview(header)

        // Card: cream background, ink border, full reply text.
        // The ‹ › nav arrows are baked into the card so the swipe affordance is always visible.
        card.backgroundColor = Self.obCard
        card.layer.cornerRadius = 14
        card.layer.borderWidth = 2
        card.layer.borderColor = Self.obInk.cgColor
        // brutalist offset shadow
        card.layer.shadowColor = Self.obInk.cgColor
        card.layer.shadowOffset = CGSize(width: 4, height: 4)
        card.layer.shadowOpacity = 1
        card.layer.shadowRadius = 0
        card.translatesAutoresizingMaskIntoConstraints = false

        // Left arrow (always visible; dims when at first draft)
        prevButton.setTitle("‹", for: .normal)
        prevButton.titleLabel?.font = .systemFont(ofSize: 34, weight: .medium)
        prevButton.setTitleColor(Self.flynnOrange, for: .normal)
        prevButton.setTitleColor(Self.flynnOrange.withAlphaComponent(0.25), for: .disabled)
        prevButton.contentEdgeInsets = UIEdgeInsets(top: 0, left: 10, bottom: 0, right: 4)
        prevButton.addTarget(self, action: #selector(onPrev), for: .touchUpInside)
        prevButton.translatesAutoresizingMaskIntoConstraints = false
        prevButton.setContentHuggingPriority(.required, for: .horizontal)

        draftLabel.numberOfLines = 0
        draftLabel.font = .systemFont(ofSize: 19, weight: .regular)
        draftLabel.textColor = Self.obInk
        draftLabel.translatesAutoresizingMaskIntoConstraints = false
        draftLabel.isUserInteractionEnabled = false

        // Right arrow (always visible; dims when at last draft)
        nextButton.setTitle("›", for: .normal)
        nextButton.titleLabel?.font = .systemFont(ofSize: 34, weight: .medium)
        nextButton.setTitleColor(Self.flynnOrange, for: .normal)
        nextButton.setTitleColor(Self.flynnOrange.withAlphaComponent(0.25), for: .disabled)
        nextButton.contentEdgeInsets = UIEdgeInsets(top: 0, left: 4, bottom: 0, right: 10)
        nextButton.addTarget(self, action: #selector(onNext), for: .touchUpInside)
        nextButton.translatesAutoresizingMaskIntoConstraints = false
        nextButton.setContentHuggingPriority(.required, for: .horizontal)

        // Page dot / counter sits below draft text, centred
        pageLabel.font = .systemFont(ofSize: 12, weight: .semibold)
        pageLabel.textColor = Self.obInk.withAlphaComponent(0.45)
        pageLabel.textAlignment = .center
        pageLabel.translatesAutoresizingMaskIntoConstraints = false

        card.addSubview(prevButton)
        card.addSubview(draftLabel)
        card.addSubview(nextButton)
        card.addSubview(pageLabel)
        NSLayoutConstraint.activate([
            // left arrow hugs left edge, vertically centred on draft text
            prevButton.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            prevButton.centerYAnchor.constraint(equalTo: draftLabel.centerYAnchor),

            // draft text fills middle
            draftLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            draftLabel.leadingAnchor.constraint(equalTo: prevButton.trailingAnchor),
            draftLabel.trailingAnchor.constraint(equalTo: nextButton.leadingAnchor),

            // right arrow hugs right edge, vertically centred on draft text
            nextButton.trailingAnchor.constraint(equalTo: card.trailingAnchor),
            nextButton.centerYAnchor.constraint(equalTo: draftLabel.centerYAnchor),

            // page counter below draft text
            pageLabel.topAnchor.constraint(equalTo: draftLabel.bottomAnchor, constant: 8),
            pageLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            pageLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            pageLabel.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -12),

            card.heightAnchor.constraint(greaterThanOrEqualToConstant: 120),
        ])

        card.addTarget(self, action: #selector(onInsert), for: .touchUpInside)
        let swipeLeft = UISwipeGestureRecognizer(target: self, action: #selector(onNext)); swipeLeft.direction = .left
        let swipeRight = UISwipeGestureRecognizer(target: self, action: #selector(onPrev)); swipeRight.direction = .right
        card.addGestureRecognizer(swipeLeft)
        card.addGestureRecognizer(swipeRight)
        container.addArrangedSubview(card)

        // Status + spinner (loading / access / empty states)
        statusLabel.font = .systemFont(ofSize: 15)
        statusLabel.textColor = Self.obInk.withAlphaComponent(0.55)
        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        container.addArrangedSubview(statusLabel)

        spinner.hidesWhenStopped = true
        spinner.color = Self.flynnOrange
        container.addArrangedSubview(spinner)
    }

    // MARK: State helpers

    private func showResults() {
        card.isHidden = false
        statusLabel.isHidden = true
    }

    private func showStatus(_ text: String) {
        statusLabel.text = text
        statusLabel.isHidden = false
        card.isHidden = true
    }

    private func renderCard() {
        guard drafts.indices.contains(index) else { return }
        draftLabel.text = drafts[index]
        // Show counter only when there are multiple drafts; hide when single.
        pageLabel.isHidden = drafts.count <= 1
        pageLabel.text = "\(index + 1) / \(drafts.count)"
        prevButton.isEnabled = index > 0
        nextButton.isEnabled = index < drafts.count - 1
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

        // Recommended flow: a screenshot capture staged by the App Intent takes
        // priority over the clipboard. Returns nil when there's nothing fresh, so
        // the clipboard path below is untouched in the copy→keyboard case.
        if let staged = SharedStore.freshStagedScreenshotDraft() {
            consumeStaged(staged)
            return
        }

        let cc = UIPasteboard.general.changeCount
        if cc == lastChangeCount && !drafts.isEmpty {
            showResults(); renderCard(); return     // nothing new copied — keep current drafts
        }
        draftFromClipboard()
    }

    /// Show drafts a screenshot capture staged for us. Marks the capture consumed
    /// immediately so a keyboard re-appear can't replay it.
    private func consumeStaged(_ staged: StagedScreenshotDraft) {
        SharedStore.markStagedScreenshotConsumed()
        lastChangeCount = UIPasteboard.general.changeCount   // ignore the clipboard for this turn
        currentSource = staged.source
        sourceMessages = staged.messages

        if !staged.drafts.isEmpty {
            drafts = staged.drafts
            index = 0
            renderCard()
            showResults()                                    // finished drafts — no network
        } else if staged.limitReached {
            showStatus("You're out of free drafts today — open Flynn to go unlimited.")
        } else {
            runDraft(messages: staged.messages)              // needsDraft — generate now
        }
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
        currentSource = "clipboard"
        runDraft(messages: messages)
    }

    /// Fetch drafts for the given messages and render them. Shared by the clipboard
    /// path and the screenshot `needsDraft` path (which sets `currentSource` first).
    private func runDraft(messages: [String]) {
        isDrafting = true
        sourceMessages = messages
        showStatus("Drafting in your voice…")
        spinner.startAnimating()

        Task { @MainActor in
            defer { spinner.stopAnimating(); isDrafting = false }
            do {
                let result = try await KeyboardDraftClient.fetchDrafts(messages: messages, source: currentSource)
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
        // Log the pick WITH the candidate set + index + source so the backend learns
        // which option the user preferred (substance), not just the chosen text (voice).
        KeyboardDraftClient.recordAccepted(
            text: draft,
            source: currentSource,
            candidates: drafts,
            pickedIndex: index,
            messages: sourceMessages.isEmpty ? nil : sourceMessages
        )
        SharedStore.resetThread()
        drafts = []
        currentSource = "clipboard"
        sourceMessages = []
        showStatus("Inserted ✓  — switch back to send.")
    }
}
