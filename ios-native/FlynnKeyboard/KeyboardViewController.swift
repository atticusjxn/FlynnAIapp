import UIKit

/// Flynn's custom keyboard. Flow: the user copies a customer's message, switches
/// to this keyboard, taps "Draft a reply" — the keyboard reads the clipboard,
/// calls the backend, and shows tone-matched draft cards. Tapping a card inserts
/// it via the text document proxy and the user sends.
///
/// Constraints honoured here:
///  - UIKit code-only, minimal allocations (keyboard extensions are ~30-60MB capped).
///  - Works without Full Access in a non-inert fallback state (App Review 4.4).
///  - Reads the clipboard only on an explicit tap (user intent; one paste banner).
final class KeyboardViewController: UIInputViewController {

    private let container = UIStackView()
    private let headerRow = UIStackView()
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let primaryButton = UIButton(type: .system)
    private let newButton = UIButton(type: .system)
    private let nextKeyboardButton = UIButton(type: .system)
    private let cardsStack = UIStackView()
    private let spinner = UIActivityIndicatorView(style: .medium)

    private var heightConstraint: NSLayoutConstraint?

    // MARK: Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        SharedStore.stampKeyboardHeartbeat()
        buildUI()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        refreshState()
    }

    override func updateViewConstraints() {
        super.updateViewConstraints()
        if heightConstraint == nil {
            let h = view.heightAnchor.constraint(equalToConstant: 290)
            h.priority = .defaultHigh
            h.isActive = true
            heightConstraint = h
        }
    }

    // MARK: UI

    private func buildUI() {
        view.backgroundColor = UIColor.secondarySystemBackground

        container.axis = .vertical
        container.spacing = 10
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

        // Header: title + "New" + globe.
        titleLabel.text = SharedStore.businessName.map { "Flynn · \($0)" } ?? "Flynn"
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.textColor = .secondaryLabel

        newButton.setTitle("New", for: .normal)
        newButton.titleLabel?.font = .systemFont(ofSize: 13, weight: .medium)
        newButton.addTarget(self, action: #selector(onNewTapped), for: .touchUpInside)

        nextKeyboardButton.setTitle("🌐", for: .normal)
        nextKeyboardButton.titleLabel?.font = .systemFont(ofSize: 18)
        nextKeyboardButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)

        headerRow.axis = .horizontal
        headerRow.alignment = .center
        headerRow.spacing = 8
        let spacer = UIView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        headerRow.addArrangedSubview(titleLabel)
        headerRow.addArrangedSubview(spacer)
        headerRow.addArrangedSubview(newButton)
        headerRow.addArrangedSubview(nextKeyboardButton)
        container.addArrangedSubview(headerRow)

        // Primary action.
        var config = UIButton.Configuration.filled()
        config.title = "✍️  Draft a reply"
        config.cornerStyle = .large
        config.baseBackgroundColor = UIColor(red: 0.145, green: 0.388, blue: 0.922, alpha: 1) // #2563EB
        primaryButton.configuration = config
        primaryButton.addTarget(self, action: #selector(onPrimaryTapped), for: .touchUpInside)
        container.addArrangedSubview(primaryButton)

        statusLabel.font = .systemFont(ofSize: 13)
        statusLabel.textColor = .secondaryLabel
        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        container.addArrangedSubview(statusLabel)

        cardsStack.axis = .vertical
        cardsStack.spacing = 8
        let scroll = UIScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.showsVerticalScrollIndicator = true
        cardsStack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(cardsStack)
        NSLayoutConstraint.activate([
            cardsStack.leadingAnchor.constraint(equalTo: scroll.leadingAnchor),
            cardsStack.trailingAnchor.constraint(equalTo: scroll.trailingAnchor),
            cardsStack.topAnchor.constraint(equalTo: scroll.topAnchor),
            cardsStack.bottomAnchor.constraint(equalTo: scroll.bottomAnchor),
            cardsStack.widthAnchor.constraint(equalTo: scroll.widthAnchor)
        ])
        container.addArrangedSubview(scroll)

        spinner.hidesWhenStopped = true
        container.addArrangedSubview(spinner)
    }

    // MARK: State

    private func refreshState() {
        titleLabel.text = SharedStore.businessName.map { "Flynn · \($0)" } ?? "Flynn"
        nextKeyboardButton.isHidden = !needsInputModeSwitchKey
        clearCards()
        spinner.stopAnimating()

        if !hasFullAccess {
            primaryButton.isHidden = true
            newButton.isHidden = true
            statusLabel.text = "Turn on Full Access for Flynn in Settings → General → Keyboard so it can draft replies from your copied message."
            return
        }

        if SharedSecureStore.keyboardToken == nil {
            primaryButton.isHidden = true
            newButton.isHidden = true
            statusLabel.text = "Open the Flynn app once to finish setup, then come back here."
            return
        }

        primaryButton.isHidden = false
        newButton.isHidden = false
        let count = SharedStore.currentMessages.count
        statusLabel.text = count > 0
            ? "Copy another message to refine, or tap to draft (\(count) in this chat)."
            : "Copy a customer's message, then tap to draft a reply."
    }

    // MARK: Actions

    @objc private func onNewTapped() {
        SharedStore.resetThread()
        refreshState()
    }

    @objc private func onPrimaryTapped() {
        guard hasFullAccess else { refreshState(); return }

        // Reading the pasteboard triggers the system paste banner — expected and
        // acceptable; it's gated behind this explicit tap (user intent).
        let copied = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let copied, !copied.isEmpty else {
            statusLabel.text = "Nothing copied yet — copy the customer's message first."
            return
        }

        let messages = SharedStore.appendCopiedMessage(copied)
        clearCards()
        statusLabel.text = "Drafting…"
        spinner.startAnimating()
        primaryButton.isEnabled = false

        Task { @MainActor in
            defer {
                spinner.stopAnimating()
                primaryButton.isEnabled = true
            }
            do {
                let drafts = try await KeyboardDraftClient.fetchDrafts(messages: messages)
                if drafts.isEmpty {
                    statusLabel.text = "Couldn't draft anything — tap to try again."
                } else {
                    statusLabel.text = "Tap a reply to insert it."
                    renderCards(drafts)
                }
            } catch KeyboardDraftClient.ClientError.notConfigured {
                statusLabel.text = "Open the Flynn app once to finish setup."
            } catch KeyboardDraftClient.ClientError.limitReached {
                statusLabel.text = "You're out of free drafts today — open Flynn to go unlimited."
            } catch {
                statusLabel.text = "Network hiccup — tap to try again."
            }
        }
    }

    // MARK: Cards

    private func clearCards() {
        cardsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    }

    private func renderCards(_ drafts: [String]) {
        clearCards()
        for draft in drafts {
            let card = UIButton(type: .system)
            var config = UIButton.Configuration.gray()
            config.title = draft
            config.titleLineBreakMode = .byWordWrapping
            config.cornerStyle = .large
            config.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 12, bottom: 10, trailing: 12)
            config.baseForegroundColor = .label
            card.configuration = config
            card.contentHorizontalAlignment = .leading
            card.titleLabel?.numberOfLines = 0
            card.addAction(UIAction { [weak self] _ in
                self?.insertDraft(draft)
            }, for: .touchUpInside)
            cardsStack.addArrangedSubview(card)
        }
    }

    private func insertDraft(_ draft: String) {
        textDocumentProxy.insertText(draft)
        // Learning loop: record what the user accepted so future drafts lean that way.
        KeyboardDraftClient.recordAccepted(text: draft)
        // A reply was sent for this thread — start fresh next time.
        SharedStore.resetThread()
        statusLabel.text = "Inserted ✓  — switch back to send."
        clearCards()
    }
}
