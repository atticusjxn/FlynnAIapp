import UIKit

/// Flynn's custom keyboard. Flow (fewest taps possible): the user copies a
/// message, switches to this keyboard, and it AUTO-DRAFTS from the clipboard on
/// appear — no "Draft a reply" tap. It shows one full reply at a time; swipe the
/// card left/right to move through the options, tap the card to insert, switch
/// back to send.
///
/// Surface: the background is the real system keyboard surface via a
/// `UIInputView(inputViewStyle: .keyboard)` backdrop — the OS draws its own
/// translucent keyboard material, so Flynn matches the native keyboard exactly
/// (not an approximated blur) and adapts to light/dark. The branded draft cards
/// carry the Flynn look, not a flat cream fill. Paging is an interactive
/// `UIScrollView`, so a draft tracks the finger and snaps to the next card.
///
/// Constraints honoured here:
///  - UIKit code-only, minimal allocations (keyboard extensions are ~30-60MB capped).
///  - Works without Full Access in a non-inert fallback state (App Review 4.4).
///  - Reads the clipboard only when its `changeCount` shows new content (one paste
///    banner per copied message, never on idle re-appears).
final class KeyboardViewController: UIInputViewController, UIScrollViewDelegate {

    // The real system keyboard surface. `UIInputView` with `.keyboard` style is the
    // documented way to get the actual translucent keyboard background the OS draws
    // for its own keyboards — not an approximated blur — so Flynn matches the native
    // keyboard exactly and adapts to light/dark automatically.
    private let backdrop = UIInputView(frame: .zero, inputViewStyle: .keyboard)
    private let container = UIStackView()
    private let titleLabel = UILabel()
    private let redraftButton = UIButton(type: .system)
    private let nextKeyboardButton = UIButton(type: .system)

    // Results: a horizontally-paging scroll view of single-reply cards. Each draft
    // is one full-width page; the card tracks the finger and snaps between options.
    private let scrollView = UIScrollView()
    private let pagesStack = UIStackView()
    private let pageControl = UIPageControl()
    private var cardViews: [UIControl] = []

    // Non-results states
    private let statusLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)

    private var drafts: [String] = []
    private var index = 0
    private var lastChangeCount = -1
    private var isDrafting = false
    /// Watches briefly for a capture that the throttled Action Button intent stages a
    /// moment after the keyboard already appeared.
    private var latePoll: Task<Void, Never>?
    private var heightConstraint: NSLayoutConstraint?

    // Where the currently-shown drafts came from ("clipboard" or "screenshot") and
    // the source messages — both sent with the pick so the backend learns by source.
    private var currentSource = "clipboard"
    private var sourceMessages: [String] = []

    private static let flynnOrange = UIColor(red: 0.984, green: 0.357, blue: 0.118, alpha: 1) // #FB5B1E

    /// Adaptive brand colors. The card stays warm and branded in light mode and
    /// shifts to a warm-dark elevated surface in dark mode so it never glares.
    private static func dynamic(_ light: UIColor, _ dark: UIColor) -> UIColor {
        UIColor { $0.userInterfaceStyle == .dark ? dark : light }
    }
    private static let cardBG = dynamic(
        UIColor(red: 1.000, green: 0.984, blue: 0.957, alpha: 1), // #FFFBF4
        UIColor(red: 0.157, green: 0.129, blue: 0.110, alpha: 1)  // warm dark
    )
    private static let cardBorder = dynamic(
        UIColor(red: 0.173, green: 0.125, blue: 0.094, alpha: 1), // ink
        UIColor(white: 1, alpha: 0.16)
    )
    private static let cardText = dynamic(
        UIColor(red: 0.173, green: 0.125, blue: 0.094, alpha: 1), // ink
        UIColor(red: 0.957, green: 0.902, blue: 0.808, alpha: 1)  // cream
    )
    private static let cardShadow = dynamic(
        UIColor(red: 0.173, green: 0.125, blue: 0.094, alpha: 1), // ink, hard brutalist offset
        UIColor.black
    )

    // MARK: Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        SharedStore.stampKeyboardHeartbeat()
        buildUI()
        // CALayer CGColors don't auto-resolve dynamic UIColors — refresh on theme flip.
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (self: Self, _) in
            self.styleCards()
        }
        // Landscape keyboards are far shorter than portrait — resize on rotation.
        registerForTraitChanges([UITraitVerticalSizeClass.self]) { (self: Self, _) in
            self.updateKeyboardHeight()
        }
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        nextKeyboardButton.isHidden = !needsInputModeSwitchKey
        titleLabel.text = "Flynn"   // no business/industry suffix — it's noise in the keyboard
        maybeAutoDraft()
    }

    override func updateViewConstraints() {
        super.updateViewConstraints()
        updateKeyboardHeight()
    }

    /// Pick a height that fits the device/orientation rather than a fixed 300pt.
    /// Portrait gets full room for the card + dots; landscape (compact vertical
    /// size class) shrinks so we don't cover the whole screen. Priority stays
    /// below 1000 so it never fights the system's own keyboard constraints during
    /// rotation (Apple's documented requirement for custom-keyboard heights).
    private func updateKeyboardHeight() {
        let target: CGFloat = traitCollection.verticalSizeClass == .compact ? 200 : 300
        if let heightConstraint {
            heightConstraint.constant = target
        } else {
            let h = view.heightAnchor.constraint(equalToConstant: target)
            h.priority = .defaultHigh
            h.isActive = true
            heightConstraint = h
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Keep the visible page aligned to the current index across rotations / resizes.
        let w = scrollView.bounds.width
        if w > 0 {
            let target = CGFloat(index) * w
            if abs(scrollView.contentOffset.x - target) > 0.5 && !scrollView.isDragging && !scrollView.isDecelerating {
                scrollView.contentOffset = CGPoint(x: target, y: 0)
            }
        }
    }

    // MARK: UI

    private func buildUI() {
        // Clear root; the UIInputView backdrop below paints the real keyboard surface.
        view.backgroundColor = .clear
        backdrop.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(backdrop)
        NSLayoutConstraint.activate([
            backdrop.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            backdrop.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            backdrop.topAnchor.constraint(equalTo: view.topAnchor),
            backdrop.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        container.axis = .vertical
        container.spacing = 8
        container.layoutMargins = UIEdgeInsets(top: 10, left: 8, bottom: 12, right: 8)
        container.isLayoutMarginsRelativeArrangement = true
        container.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(container)
        NSLayoutConstraint.activate([
            container.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            container.topAnchor.constraint(equalTo: view.topAnchor),
            container.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        // Header: Flynn · Business  ↻ Redraft  🌐
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.textColor = .secondaryLabel

        redraftButton.setTitle("↻ Redraft", for: .normal)
        redraftButton.titleLabel?.font = .systemFont(ofSize: 13, weight: .semibold)
        redraftButton.tintColor = Self.flynnOrange
        redraftButton.addTarget(self, action: #selector(onRedraft), for: .touchUpInside)

        nextKeyboardButton.setTitle("🌐", for: .normal)
        nextKeyboardButton.titleLabel?.font = .systemFont(ofSize: 18)
        nextKeyboardButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)

        let header = UIStackView(arrangedSubviews: [titleLabel, UIView(), redraftButton, nextKeyboardButton])
        header.axis = .horizontal; header.alignment = .center; header.spacing = 10
        header.layoutMargins = UIEdgeInsets(top: 0, left: 6, bottom: 0, right: 6)
        header.isLayoutMarginsRelativeArrangement = true
        container.addArrangedSubview(header)

        // Interactive paging scroll view: one card per draft, full-width pages.
        scrollView.isPagingEnabled = true
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.alwaysBounceHorizontal = true
        // Delay touches to the card so the scroll view can claim a horizontal pan
        // first — otherwise a swipe to change drafts registers as a tap and inserts.
        // A real tap still inserts after the brief (imperceptible) pan-detection window.
        scrollView.delaysContentTouches = true
        scrollView.canCancelContentTouches = true
        scrollView.delegate = self
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.setContentHuggingPriority(.defaultLow, for: .vertical)
        scrollView.setContentCompressionResistancePriority(.defaultLow, for: .vertical)

        pagesStack.axis = .horizontal
        pagesStack.distribution = .fill
        pagesStack.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(pagesStack)

        NSLayoutConstraint.activate([
            pagesStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            pagesStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            pagesStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            pagesStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            pagesStack.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor),
        ])
        // A soft floor so the card stays readable — but low priority so it never
        // fights the (shorter) landscape keyboard height.
        let minCardHeight = scrollView.heightAnchor.constraint(greaterThanOrEqualToConstant: 120)
        minCardHeight.priority = .defaultLow
        minCardHeight.isActive = true
        container.addArrangedSubview(scrollView)

        // Native page dots — replace the in-card arrows and free the card for text.
        pageControl.currentPageIndicatorTintColor = Self.flynnOrange
        pageControl.pageIndicatorTintColor = UIColor.label.withAlphaComponent(0.22)
        pageControl.hidesForSinglePage = true
        pageControl.addTarget(self, action: #selector(onPageControl), for: .valueChanged)
        container.addArrangedSubview(pageControl)

        // Status + spinner (loading / access / empty states)
        statusLabel.font = .systemFont(ofSize: 15)
        statusLabel.textColor = .secondaryLabel
        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        container.addArrangedSubview(statusLabel)

        spinner.hidesWhenStopped = true
        spinner.color = Self.flynnOrange
        container.addArrangedSubview(spinner)
    }

    /// Build one branded card per draft as full-width pages inside the scroll view.
    private func rebuildPages() {
        cardViews.forEach { $0.removeFromSuperview() }
        cardViews.removeAll()
        pagesStack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for (i, text) in drafts.enumerated() {
            // Page container provides the gutter + room for the brutalist offset shadow.
            let page = UIView()
            page.translatesAutoresizingMaskIntoConstraints = false

            let card = UIControl()
            card.backgroundColor = Self.cardBG
            card.layer.cornerRadius = 16
            card.layer.borderWidth = 2
            card.layer.shadowOffset = CGSize(width: 4, height: 4)
            card.layer.shadowRadius = 0
            card.tag = i
            card.translatesAutoresizingMaskIntoConstraints = false
            card.addTarget(self, action: #selector(onInsert), for: .touchUpInside)

            let label = UILabel()
            label.numberOfLines = 0
            label.font = .systemFont(ofSize: 19, weight: .regular)
            label.textColor = Self.cardText
            label.text = text
            label.isUserInteractionEnabled = false
            label.translatesAutoresizingMaskIntoConstraints = false

            let hint = UILabel()
            hint.font = .systemFont(ofSize: 11, weight: .semibold)
            hint.textColor = Self.cardText.withAlphaComponent(0.4)
            hint.text = "Tap to insert"
            hint.translatesAutoresizingMaskIntoConstraints = false

            card.addSubview(label)
            card.addSubview(hint)
            page.addSubview(card)

            NSLayoutConstraint.activate([
                // Card fills the page with a gutter; bottom/right gap leaves room for the shadow.
                card.leadingAnchor.constraint(equalTo: page.leadingAnchor, constant: 7),
                card.trailingAnchor.constraint(equalTo: page.trailingAnchor, constant: -9),
                card.topAnchor.constraint(equalTo: page.topAnchor, constant: 2),
                card.bottomAnchor.constraint(equalTo: page.bottomAnchor, constant: -9),

                // Reply text — vertically centred, wraps, never overflows the card.
                label.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
                label.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18),
                label.centerYAnchor.constraint(equalTo: card.centerYAnchor),
                label.topAnchor.constraint(greaterThanOrEqualTo: card.topAnchor, constant: 16),
                label.bottomAnchor.constraint(lessThanOrEqualTo: hint.topAnchor, constant: -8),

                hint.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
                hint.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -12),
            ])

            pagesStack.addArrangedSubview(page)
            // Activate page-width ONLY after `page` is in the scroll view's hierarchy —
            // before that, `page` and `scrollView.frameLayoutGuide` share no common
            // ancestor and `setActive` throws an NSException (SIGABRT → keyboard crash).
            page.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor).isActive = true
            cardViews.append(card)
        }

        pageControl.numberOfPages = drafts.count
        styleCards()
    }

    /// Resolve the CALayer CGColors (border + offset shadow) against the current theme.
    private func styleCards() {
        let isDark = traitCollection.userInterfaceStyle == .dark
        for card in cardViews {
            card.layer.borderColor = Self.cardBorder.resolvedColor(with: traitCollection).cgColor
            card.layer.shadowColor = Self.cardShadow.resolvedColor(with: traitCollection).cgColor
            // Hard brutalist offset reads great on light; soften on dark so it isn't muddy.
            card.layer.shadowOpacity = isDark ? 0.5 : 1
        }
    }

    // MARK: State helpers

    private func showResults() {
        scrollView.isHidden = false
        pageControl.isHidden = drafts.count <= 1
        statusLabel.isHidden = true
    }

    private func showStatus(_ text: String) {
        statusLabel.text = text
        statusLabel.isHidden = false
        scrollView.isHidden = true
        pageControl.isHidden = true
    }

    /// Rebuild the pages for the current `drafts` and snap to `index`.
    private func renderCard() {
        guard !drafts.isEmpty else { return }
        index = min(index, drafts.count - 1)
        rebuildPages()
        pageControl.currentPage = index
        view.layoutIfNeeded()
        let w = scrollView.bounds.width
        if w > 0 { scrollView.contentOffset = CGPoint(x: CGFloat(index) * w, y: 0) }
    }

    private func scrollToIndex(_ i: Int, animated: Bool) {
        guard drafts.indices.contains(i) else { return }
        index = i
        pageControl.currentPage = i
        let w = scrollView.bounds.width
        guard w > 0 else { return }
        scrollView.setContentOffset(CGPoint(x: CGFloat(i) * w, y: 0), animated: animated)
    }

    // MARK: Scroll paging

    func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) {
        updateIndexFromOffset()
    }

    func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) {
        updateIndexFromOffset()
    }

    private func updateIndexFromOffset() {
        let w = scrollView.bounds.width
        guard w > 0 else { return }
        let i = Int((scrollView.contentOffset.x / w).rounded())
        index = max(0, min(i, max(0, drafts.count - 1)))
        pageControl.currentPage = index
    }

    @objc private func onPageControl() {
        scrollToIndex(pageControl.currentPage, animated: true)
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
        latePoll?.cancel()

        // Recommended flow: a screenshot capture staged by the App Intent takes
        // priority over the clipboard. Returns nil when there's nothing fresh, so
        // the clipboard path below is untouched in the copy→keyboard case.
        if let staged = SharedStore.freshStagedScreenshotDraft() {
            if staged.capturing {
                awaitCapture()        // capture in flight — show "reading…" and poll for it
            } else {
                consumeStaged(staged)
            }
            return
        }

        let cc = UIPasteboard.general.changeCount
        if cc != lastChangeCount {
            draftFromClipboard()                     // genuinely new copy — draft it now
            return
        }
        if !drafts.isEmpty {
            showResults(); renderCard(); return      // nothing new — keep current drafts
        }
        // Nothing staged yet and nothing new copied. The Action Button intent can lag
        // a few seconds in the background, so show the idle prompt but keep watching —
        // if a capture lands shortly after, switch to it without needing a re-open.
        draftFromClipboard()
        watchForLateCapture()
    }

    /// Poll briefly for a capture the throttled background intent stages just after the
    /// keyboard appeared, so the user doesn't have to toggle the keyboard to pick it up.
    private func watchForLateCapture() {
        latePoll?.cancel()
        latePoll = Task { @MainActor in
            let deadline = Date().addingTimeInterval(10)
            while Date() < deadline {
                try? await Task.sleep(for: .milliseconds(300))
                if Task.isCancelled || isDrafting || !drafts.isEmpty { return }
                if let staged = SharedStore.freshStagedScreenshotDraft() {
                    if staged.capturing { awaitCapture() } else { consumeStaged(staged) }
                    return
                }
            }
        }
    }

    /// Show drafts a screenshot capture staged for us. Marks the capture consumed
    /// immediately so a keyboard re-appear can't replay it.
    private func consumeStaged(_ staged: StagedScreenshotDraft) {
        SharedStore.markStagedScreenshotConsumed()
        lastChangeCount = UIPasteboard.general.changeCount   // ignore the clipboard for this turn
        currentSource = staged.source
        sourceMessages = staged.messages
        drafts = []   // always clear stale drafts so old results never bleed through

        if !staged.drafts.isEmpty {
            drafts = staged.drafts
            index = 0
            renderCard()
            showResults()                                    // finished drafts — no network
        } else if staged.limitReached {
            showStatus("You're out of free drafts today — open Flynn to go unlimited.")
        } else if !staged.messages.isEmpty {
            runDraft(messages: staged.messages)              // needsDraft — generate now
        } else {
            showStatus("Couldn't read that screen — copy the message and tap ↻ Redraft.")
        }
    }

    /// A capture is in flight (Action Button just fired, OCR/draft still running in the
    /// app). Show a reading state and poll the App Group until the intent stages the
    /// terminal result, then render it. Falls back to the clipboard path on timeout.
    private func awaitCapture() {
        if isDrafting { return }
        isDrafting = true
        showStatus("Reading your screen…")
        spinner.startAnimating()

        Task { @MainActor in
            let deadline = Date().addingTimeInterval(8)
            while Date() < deadline {
                try? await Task.sleep(for: .milliseconds(250))
                guard let staged = SharedStore.freshStagedScreenshotDraft() else { break }
                if !staged.capturing {                       // intent finished — render it
                    spinner.stopAnimating(); isDrafting = false
                    consumeStaged(staged)
                    return
                }
            }
            // Timed out or the marker vanished — fall back to the clipboard/idle path.
            spinner.stopAnimating(); isDrafting = false
            draftFromClipboard()
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
