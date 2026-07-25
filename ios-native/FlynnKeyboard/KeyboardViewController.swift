import UIKit

/// Flynn's custom keyboard. Two ways in, both driven by the operator's real
/// business data rather than by anything Flynn scraped:
///
///  1. **Chips** — when the text field is empty, a row of one-tap inserts for the
///     things a tradie actually needs mid-conversation: their next genuinely-free
///     slots, a pay link for an open invoice, their rate. Zero latency: painted
///     from the App Group cache, refreshed in the background.
///  2. **Polish** — the operator types shorthand on the SYSTEM keyboard
///     ("quote 450 deck, free thurs"), switches to Flynn, and taps Polish. Flynn
///     expands it into send-ready options carrying their real price/availability/
///     pay link. Swipe the cards, tap to replace what they typed.
///
/// Why it works this way: an iOS keyboard extension can only read the text field
/// the cursor is in (`documentContextBeforeInput`, truncated by iOS), never the
/// conversation. So Flynn cannot infer a reply to a customer message it cannot
/// see — the operator's own shorthand is the brief. The previous design worked
/// around that with an Action Button screenshot + OCR chain; that was abandoned as
/// too many steps for context thinner than what the app already holds.
///
/// Flynn never sends. It inserts; the operator hits send in their own app.
///
/// Surface: the background is the real system keyboard surface via a
/// `UIInputView(inputViewStyle: .keyboard)` backdrop — the OS draws its own
/// translucent keyboard material, so Flynn matches the native keyboard exactly
/// (not an approximated blur) and adapts to light/dark. The branded cards carry
/// the Flynn look, not a flat cream fill. Paging is an interactive `UIScrollView`,
/// so a card tracks the finger and snaps to the next option.
///
/// Constraints honoured here:
///  - UIKit code-only, minimal allocations (keyboard extensions are ~30-60MB capped).
///  - Works without Full Access in a non-inert fallback state (App Review 4.4).
///  - The text field is read ONLY on an explicit Polish tap, never speculatively
///    on appear. That is both the privacy story and the literal behaviour.
///  - No pasteboard access at all, so no "Pasting from Flynn" banner.
final class KeyboardViewController: UIInputViewController, UIScrollViewDelegate {

    // The real system keyboard surface. `UIInputView` with `.keyboard` style is the
    // documented way to get the actual translucent keyboard background the OS draws
    // for its own keyboards — not an approximated blur — so Flynn matches the native
    // keyboard exactly and adapts to light/dark automatically.
    private let backdrop = UIInputView(frame: .zero, inputViewStyle: .keyboard)
    private let container = UIStackView()
    private let titleLabel = UILabel()
    private let redraftButton = UIButton(type: .system)
    private let savedButton = UIButton(type: .system)
    private let nextKeyboardButton = UIButton(type: .system)

    // Saved (canned) messages: a vertical list of tappable cards the user maintains
    // in the app. Tapping the "Saved" header button swaps the draft view for this
    // list; tapping a card inserts that message. Lives in the same flex slot as the
    // draft scroll view so the layout stays put.
    private let savedScroll = UIScrollView()
    private let savedStack = UIStackView()
    private var isShowingSaved = false

    // Post-insert "Add to Google Calendar" chip. Appears below "Inserted ✓" after
    // the user taps a card — not before, so it doesn't crowd the draft view.
    private let bookButton = UIButton(type: .system)
    private let bookRow = UIStackView()
    private var pendingEvent: AgreedEvent?

    // Results: a horizontally-paging scroll view of single-reply cards. Each draft
    // is one full-width page; the card tracks the finger and snaps between options.
    private let scrollView = UIScrollView()
    private let pagesStack = UIStackView()
    private let pageControl = UIPageControl()
    private var cardViews: [UIControl] = []

    // Non-results states — statusContainer takes the flex slot scrollView occupies
    // so content stays vertically centred instead of anchored to the bottom.
    private let statusContainer = UIView()
    private let statusLabel = UILabel()
    private let loadingTrack = UIView()
    private let loadingFill = UIView()
    private var fillWidthConstraint: NSLayoutConstraint?

    // Chips row: one-tap inserts of the operator's real data, shown in the idle
    // state. Horizontally scrollable because a tradie with three open invoices
    // plus slots plus rates overflows the width.
    private let chipsScroll = UIScrollView()
    private let chipsStack = UIStackView()

    // Idle-state action bar: "Polish what I typed", enabled only once the field
    // holds enough text to be worth expanding.
    private let polishButton = UIButton(type: .system)
    private let polishRow = UIStackView()

    private var drafts: [String] = []
    private var index = 0
    private var isDrafting = false
    private var heightConstraint: NSLayoutConstraint?

    /// Last fetched chips payload. Seeded synchronously from the App Group cache so
    /// the first paint never waits on the network.
    private var quickContext: QuickContext = .empty
    private var refreshTask: Task<Void, Never>?

    /// The shorthand the operator had typed when they tapped Polish. Kept so a card
    /// tap can delete exactly that text before inserting the polished version, and
    /// so it can be sent as the training signal for how this user abbreviates.
    private var originalShorthand: String?

    /// True when tapping a card should REPLACE `originalShorthand`; false when it
    /// should just insert at the cursor. Set false when the cursor is not at the end
    /// of the field, because iOS truncates the context we can read and we will not
    /// delete text we cannot verify.
    private var canReplace = false

    // Which mode produced the currently-shown cards ("rewrite" or "chip") and the
    // source text — both sent with the pick so the backend learns by source.
    private var currentSource = "rewrite"
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

        // Paint from cache first (synchronous, no network), then refresh. The
        // extension is relaunched on nearly every keyboard switch and gets a fresh
        // URLSession each time, so a network-first chips row would visibly pop in
        // late every single time.
        if let cached = SharedStore.cachedQuickContext() {
            quickContext = cached
        }
        showIdleState()
        refreshQuickContext()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        refreshTask?.cancel()
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
        // The idle chrome (chips + Polish) and the results chrome (card + dots) are
        // never visible at the same time, so this only needs a modest bump over the
        // original 300/200 to give the chips row room without squeezing the card.
        let target: CGFloat = traitCollection.verticalSizeClass == .compact ? 210 : 320
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

        savedButton.setTitle("Saved", for: .normal)
        savedButton.titleLabel?.font = .systemFont(ofSize: 13, weight: .semibold)
        savedButton.tintColor = Self.flynnOrange
        savedButton.addTarget(self, action: #selector(onSavedTap), for: .touchUpInside)

        nextKeyboardButton.setTitle("🌐", for: .normal)
        nextKeyboardButton.titleLabel?.font = .systemFont(ofSize: 18)
        nextKeyboardButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)

        let header = UIStackView(arrangedSubviews: [titleLabel, UIView(), savedButton, redraftButton, nextKeyboardButton])
        header.axis = .horizontal; header.alignment = .center; header.spacing = 10
        header.layoutMargins = UIEdgeInsets(top: 0, left: 6, bottom: 0, right: 6)
        header.isLayoutMarginsRelativeArrangement = true
        container.addArrangedSubview(header)

        // Chips row: horizontal scroll of one-tap real-data inserts. Pinned to the
        // contentLayoutGuide on all four edges with height tied to the frame guide —
        // the same idiom already proven on savedScroll below.
        chipsScroll.showsHorizontalScrollIndicator = false
        chipsScroll.alwaysBounceHorizontal = true
        chipsScroll.translatesAutoresizingMaskIntoConstraints = false
        chipsStack.axis = .horizontal
        chipsStack.spacing = 8
        chipsStack.alignment = .center
        chipsStack.translatesAutoresizingMaskIntoConstraints = false
        chipsScroll.addSubview(chipsStack)
        NSLayoutConstraint.activate([
            chipsStack.leadingAnchor.constraint(equalTo: chipsScroll.contentLayoutGuide.leadingAnchor, constant: 6),
            chipsStack.trailingAnchor.constraint(equalTo: chipsScroll.contentLayoutGuide.trailingAnchor, constant: -6),
            chipsStack.topAnchor.constraint(equalTo: chipsScroll.contentLayoutGuide.topAnchor),
            chipsStack.bottomAnchor.constraint(equalTo: chipsScroll.contentLayoutGuide.bottomAnchor),
            chipsStack.heightAnchor.constraint(equalTo: chipsScroll.frameLayoutGuide.heightAnchor),
            chipsScroll.heightAnchor.constraint(equalToConstant: 38),
        ])
        container.addArrangedSubview(chipsScroll)

        // "Polish what I typed" — the entry point to rewrite mode. Disabled until
        // the field holds enough to expand, so it can never fire on an empty field.
        var polishConfig = UIButton.Configuration.tinted()
        polishConfig.cornerStyle = .capsule
        polishConfig.baseForegroundColor = Self.flynnOrange
        polishConfig.baseBackgroundColor = Self.flynnOrange
        polishConfig.title = "✨ Polish what I typed"
        polishConfig.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 18, bottom: 8, trailing: 18)
        polishButton.configuration = polishConfig
        polishButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
        polishButton.addTarget(self, action: #selector(onPolishTap), for: .touchUpInside)

        let polishLead = UIView()
        let polishTrail = UIView()
        polishRow.axis = .horizontal
        polishRow.alignment = .center
        polishRow.addArrangedSubview(polishLead)
        polishRow.addArrangedSubview(polishButton)
        polishRow.addArrangedSubview(polishTrail)
        polishLead.widthAnchor.constraint(equalTo: polishTrail.widthAnchor).isActive = true
        container.addArrangedSubview(polishRow)

        // Post-insert "Add to Google Calendar" chip — appears below "Inserted ✓".
        var chipConfig = UIButton.Configuration.tinted()
        chipConfig.cornerStyle = .capsule
        chipConfig.baseForegroundColor = UIColor(red: 0.102, green: 0.451, blue: 0.910, alpha: 1) // Google blue #1a73e8
        chipConfig.baseBackgroundColor = UIColor(red: 0.102, green: 0.451, blue: 0.910, alpha: 1)
        chipConfig.image = Self.googleCalendarIcon(size: 18)
        chipConfig.imagePadding = 8
        chipConfig.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16)
        bookButton.configuration = chipConfig
        bookButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
        bookButton.addTarget(self, action: #selector(onBookTap), for: .touchUpInside)

        let leadSpace = UIView()
        let trailSpace = UIView()
        bookRow.axis = .horizontal
        bookRow.alignment = .center
        bookRow.addArrangedSubview(leadSpace)
        bookRow.addArrangedSubview(bookButton)
        bookRow.addArrangedSubview(trailSpace)
        leadSpace.widthAnchor.constraint(equalTo: trailSpace.widthAnchor).isActive = true
        bookRow.isHidden = true

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

        // Saved-messages list — a vertical scroll of tappable cards. Hidden until the
        // user taps "Saved"; occupies the same flex slot as the draft scroll view.
        savedScroll.showsVerticalScrollIndicator = false
        savedScroll.alwaysBounceVertical = true
        savedScroll.translatesAutoresizingMaskIntoConstraints = false
        savedScroll.isHidden = true
        savedStack.axis = .vertical
        savedStack.spacing = 8
        savedStack.translatesAutoresizingMaskIntoConstraints = false
        savedScroll.addSubview(savedStack)
        NSLayoutConstraint.activate([
            savedStack.leadingAnchor.constraint(equalTo: savedScroll.contentLayoutGuide.leadingAnchor),
            savedStack.trailingAnchor.constraint(equalTo: savedScroll.contentLayoutGuide.trailingAnchor),
            savedStack.topAnchor.constraint(equalTo: savedScroll.contentLayoutGuide.topAnchor),
            savedStack.bottomAnchor.constraint(equalTo: savedScroll.contentLayoutGuide.bottomAnchor),
            savedStack.widthAnchor.constraint(equalTo: savedScroll.frameLayoutGuide.widthAnchor),
        ])
        container.addArrangedSubview(savedScroll)

        // Native page dots — replace the in-card arrows and free the card for text.
        pageControl.currentPageIndicatorTintColor = Self.flynnOrange
        pageControl.pageIndicatorTintColor = UIColor.label.withAlphaComponent(0.22)
        pageControl.hidesForSinglePage = true
        pageControl.addTarget(self, action: #selector(onPageControl), for: .valueChanged)
        container.addArrangedSubview(pageControl)

        // Status/loading container — sits in the same flex slot as scrollView so
        // when it's visible it fills the available space and can centre its content.
        statusContainer.setContentHuggingPriority(.defaultLow, for: .vertical)
        statusContainer.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        statusContainer.isHidden = true

        statusLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        statusLabel.textColor = Self.cardText
        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusContainer.addSubview(statusLabel)

        loadingTrack.backgroundColor = UIColor(red: 0.957, green: 0.902, blue: 0.808, alpha: 1)
        loadingTrack.layer.cornerRadius = 3
        loadingTrack.clipsToBounds = true
        loadingTrack.isHidden = true
        loadingTrack.translatesAutoresizingMaskIntoConstraints = false
        statusContainer.addSubview(loadingTrack)

        loadingFill.backgroundColor = Self.flynnOrange
        loadingFill.translatesAutoresizingMaskIntoConstraints = false
        loadingTrack.addSubview(loadingFill)

        NSLayoutConstraint.activate([
            // Label: padded, centred slightly above vertical middle so the bar sits below
            statusLabel.leadingAnchor.constraint(equalTo: statusContainer.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: statusContainer.trailingAnchor, constant: -16),
            statusLabel.centerYAnchor.constraint(equalTo: statusContainer.centerYAnchor, constant: -10),

            // Bar: just below the label
            loadingTrack.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 14),
            loadingTrack.leadingAnchor.constraint(equalTo: statusContainer.leadingAnchor, constant: 16),
            loadingTrack.trailingAnchor.constraint(equalTo: statusContainer.trailingAnchor, constant: -16),
            loadingTrack.heightAnchor.constraint(equalToConstant: 6),

            // Fill inside the track
            loadingFill.leadingAnchor.constraint(equalTo: loadingTrack.leadingAnchor),
            loadingFill.topAnchor.constraint(equalTo: loadingTrack.topAnchor),
            loadingFill.bottomAnchor.constraint(equalTo: loadingTrack.bottomAnchor),
        ])
        fillWidthConstraint = loadingFill.widthAnchor.constraint(equalToConstant: 0)
        fillWidthConstraint?.isActive = true

        container.addArrangedSubview(statusContainer)
        // bookRow sits BELOW statusContainer so it appears under "Inserted ✓" post-insert.
        container.addArrangedSubview(bookRow)
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
            // Be literal about what the tap does: replacing the operator's own typed
            // text is a bigger deal than appending, so never label it "insert".
            hint.text = canReplace ? "Tap to replace what you typed" : "Tap to insert"
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

    /// Show/hide the idle chrome (chips row + Polish button). Hidden whenever cards
    /// are on screen so the options get the full height.
    private func setIdleChrome(visible: Bool) {
        chipsScroll.isHidden = !visible || chipsStack.arrangedSubviews.isEmpty
        polishRow.isHidden = !visible
    }

    private func showResults() {
        scrollView.isHidden = false
        pageControl.isHidden = drafts.count <= 1
        statusContainer.isHidden = true
        setIdleChrome(visible: false)
    }

    private func showStatus(_ text: String) {
        statusLabel.text = text
        loadingTrack.isHidden = true
        statusContainer.isHidden = false
        scrollView.isHidden = true
        pageControl.isHidden = true
        bookRow.isHidden = true
    }

    /// Show the branded loading bar with a status label. Animates the fill to ~80%
    /// over 1.1 s; `showResults()` or `showStatus()` hide the container when done.
    private func showDrafting(label: String) {
        statusLabel.text = label
        scrollView.isHidden = true
        pageControl.isHidden = true
        bookRow.isHidden = true
        setIdleChrome(visible: false)

        fillWidthConstraint?.constant = 0
        loadingTrack.isHidden = false
        statusContainer.isHidden = false

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let trackW = self.loadingTrack.bounds.width
            let target = trackW > 1 ? trackW * 0.80 : (self.view.bounds.width - 32) * 0.80
            self.fillWidthConstraint?.constant = target
            UIView.animate(withDuration: 1.1, delay: 0, options: [.curveEaseOut]) {
                self.loadingTrack.layoutIfNeeded()
            }
        }
    }

    // MARK: Calendar booking chip

    /// Save the agreed event quietly — the chip is only shown post-insert, below "Inserted ✓".
    private func showBookingChip(for event: AgreedEvent?) {
        pendingEvent = event
    }

    private func hideBookingChip() {
        pendingEvent = nil
        bookRow.isHidden = true
    }

    /// Set the button title to "Add <time> to Google Calendar" and show the chip.
    private func showPostInsertCalendarChip(for event: AgreedEvent) {
        pendingEvent = event
        guard let date = PendingCalendarEvent.parseISO(event.startISO) else { return }
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.setLocalizedDateFormatFromTemplate("EEE d MMM h:mm a")
        var cfg = bookButton.configuration
        cfg?.title = "Add \(formatter.string(from: date)) to Google Calendar"
        cfg?.baseForegroundColor = UIColor(red: 0.102, green: 0.451, blue: 0.910, alpha: 1)
        cfg?.baseBackgroundColor = UIColor(red: 0.102, green: 0.451, blue: 0.910, alpha: 1)
        cfg?.image = Self.googleCalendarIcon(size: 18)
        bookButton.configuration = cfg
        bookButton.isEnabled = true
        bookRow.isHidden = false
    }

    @objc private func onBookTap() {
        guard let event = pendingEvent else { return }
        var cfg = bookButton.configuration
        cfg?.title = "Adding…"
        cfg?.image = nil
        bookButton.configuration = cfg
        bookButton.isEnabled = false

        Task { @MainActor in
            do {
                try await KeyboardDraftClient.addCalendarEvent(event)
                var done = bookButton.configuration
                done?.title = "Added to Google Calendar ✓"
                done?.baseForegroundColor = .systemGreen
                done?.baseBackgroundColor = .systemGreen
                done?.image = UIImage(systemName: "checkmark")
                bookButton.configuration = done
                pendingEvent = nil
            } catch {
                // Restore so user can retry
                var retry = bookButton.configuration
                retry?.title = "Add to Google Calendar"
                retry?.image = Self.googleCalendarIcon(size: 18)
                bookButton.configuration = retry
                bookButton.isEnabled = true
            }
        }
    }

    // MARK: Google Calendar icon

    /// Programmatic Google Calendar logo: white body, blue header bar, blue "31".
    private static func googleCalendarIcon(size: CGFloat) -> UIImage {
        let sz = CGSize(width: size, height: size)
        let renderer = UIGraphicsImageRenderer(size: sz)
        return renderer.image { _ in
            let googleBlue = UIColor(red: 0.102, green: 0.451, blue: 0.910, alpha: 1)
            let corner = size * 0.15
            let rect = CGRect(origin: .zero, size: sz)

            // White background
            UIColor.white.setFill()
            UIBezierPath(roundedRect: rect, cornerRadius: corner).fill()

            // Blue header (top 30%)
            let hh = size * 0.30
            let headerPath = UIBezierPath(
                roundedRect: CGRect(x: 0, y: 0, width: size, height: hh + corner),
                cornerRadius: corner
            )
            googleBlue.setFill()
            headerPath.fill()
            // Square off the bottom of the header
            UIBezierPath(rect: CGRect(x: 0, y: corner, width: size, height: hh)).fill()

            // Blue border
            googleBlue.setStroke()
            let border = UIBezierPath(roundedRect: rect.insetBy(dx: 0.5, dy: 0.5), cornerRadius: corner)
            border.lineWidth = 1
            border.stroke()

            // "31" number in body
            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: size * 0.40, weight: .bold),
                .foregroundColor: googleBlue,
            ]
            let str = NSAttributedString(string: "31", attributes: attrs)
            let ss = str.size()
            str.draw(at: CGPoint(
                x: (size - ss.width) / 2,
                y: hh + (size - hh - ss.height) / 2
            ))
        }
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

    // MARK: Idle state (chips + Polish)

    /// The resting state: chips for one-tap real-data inserts, plus Polish for
    /// expanding whatever the operator has typed. Cheap and synchronous — safe to
    /// call on every appear.
    private func showIdleState() {
        if isShowingSaved { return }   // don't clobber the saved-messages list
        guard hasFullAccess else {
            setIdleChrome(visible: false)
            showStatus("Turn on Full Access for Flynn in Settings → General → Keyboard so it can pull your invoices, rates and availability.")
            return
        }
        guard SharedSecureStore.keyboardToken != nil else {
            setIdleChrome(visible: false)
            showStatus("Open the Flynn app once to finish setup, then come back here.")
            return
        }
        if isDrafting { return }

        // Keep showing existing options rather than throwing them away on a re-appear.
        if !drafts.isEmpty {
            showResults(); renderCard(); return
        }

        rebuildChips()
        updatePolishAvailability()
        showStatus(quickContext.isEmpty
            ? "Type what you want to say, then tap Polish. Or add invoices and rates in the Flynn app to get one-tap inserts here."
            : "Tap a chip to drop in real details, or type something and tap Polish.")
        setIdleChrome(visible: true)
    }

    /// Enable Polish only when the field holds enough to be worth expanding, and
    /// never in fields where a prose reply makes no sense.
    private func updatePolishAvailability() {
        let typed = (textDocumentProxy.documentContextBeforeInput ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let badFieldType: Bool
        switch textDocumentProxy.keyboardType {
        case .some(.numberPad), .some(.phonePad), .some(.emailAddress),
             .some(.URL), .some(.decimalPad):
            badFieldType = true
        default:
            badFieldType = false
        }
        polishButton.isEnabled = typed.count >= 8 && !badFieldType
    }

    /// Fetch fresh chips data in the background and re-render if it changed.
    /// Never blocks the UI: a failure just leaves the cached chips in place.
    private func refreshQuickContext() {
        guard hasFullAccess, SharedSecureStore.keyboardToken != nil else { return }
        refreshTask?.cancel()
        refreshTask = Task { @MainActor in
            do {
                let fresh = try await KeyboardDraftClient.quickContext()
                if Task.isCancelled { return }
                quickContext = fresh
                SharedStore.cacheQuickContext(fresh)
                // Only touch the UI if the user is still sitting in the idle state.
                if drafts.isEmpty && !isDrafting && !isShowingSaved {
                    rebuildChips()
                    setIdleChrome(visible: true)
                }
            } catch {
                // Cached chips stay on screen; nothing to say to the user here.
            }
        }
    }

    /// Build one capsule button per available chip. Each closure captures its own
    /// insert text directly, so there is no tag-to-index lookup to get out of step.
    private func rebuildChips() {
        chipsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        var chips: [(title: String, text: String)] = []
        if let slotsText = quickContext.slotsInsertText {
            chips.append(("Next free", slotsText))
        }
        for invoice in quickContext.invoices {
            let who = invoice.clientName ?? "Invoice"
            chips.append(("\(who) · \(invoice.amountLabel)", invoice.insertText))
        }
        for rate in quickContext.rates {
            chips.append((rate.label, rate.insertText))
        }

        for chip in chips.prefix(6) {
            var config = UIButton.Configuration.tinted()
            config.cornerStyle = .capsule
            config.baseForegroundColor = Self.flynnOrange
            config.baseBackgroundColor = Self.flynnOrange
            config.title = chip.title
            config.contentInsets = NSDirectionalEdgeInsets(top: 6, leading: 14, bottom: 6, trailing: 14)

            let button = UIButton(type: .system)
            button.configuration = config
            button.titleLabel?.font = .systemFont(ofSize: 13, weight: .semibold)
            let text = chip.text
            button.addAction(UIAction { [weak self] _ in self?.insertChip(text) }, for: .touchUpInside)
            chipsStack.addArrangedSubview(button)
        }
    }

    /// Insert a chip's real data at the cursor. Never replaces anything — the
    /// operator may well have typed context around it.
    private func insertChip(_ text: String) {
        textDocumentProxy.insertText(text)
        KeyboardDraftClient.recordAccepted(text: text, source: "chip")
        drafts = []
        hideBookingChip()
        showStatus("Inserted ✓  — switch back to send.")
        setIdleChrome(visible: true)
    }

    // MARK: Polish (typed shorthand → send-ready options)

    @objc private func onPolishTap() {
        guard hasFullAccess else { showIdleState(); return }
        guard !isDrafting else { return }

        // Read the field ONLY here, on an explicit tap — never speculatively.
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let after = textDocumentProxy.documentContextAfterInput ?? ""
        let shorthand = before.trimmingCharacters(in: .whitespacesAndNewlines)

        guard shorthand.count >= 8 else {
            showStatus("Type what you want to say first, then tap Polish.")
            setIdleChrome(visible: true)
            return
        }

        // Only offer to REPLACE when the cursor sits at the end of the field. iOS
        // truncates the context we can read, so with text after the cursor we cannot
        // know what we'd be deleting — in that case we insert instead of replacing.
        canReplace = after.isEmpty
        originalShorthand = before
        runCompose(text: shorthand)
    }

    /// Expand the shorthand into options and render them in the existing carousel.
    private func runCompose(text: String) {
        isDrafting = true
        currentSource = "rewrite"
        // The shorthand is the training signal: it teaches Flynn how this operator
        // abbreviates, which is what makes later expansions sound like them.
        sourceMessages = [text]
        showDrafting(label: "Writing it out in your voice…")

        Task { @MainActor in
            defer { isDrafting = false }
            do {
                let candidates = try await KeyboardDraftClient.compose(text: text)
                if candidates.isEmpty {
                    showStatus("Couldn't write that up — tap ↻ Redraft to try again.")
                    setIdleChrome(visible: true)
                } else {
                    drafts = candidates
                    index = 0
                    renderCard()
                    showResults()
                }
            } catch KeyboardDraftClient.ClientError.notConfigured {
                showStatus("Open the Flynn app once to finish setup.")
            } catch KeyboardDraftClient.ClientError.unauthorized {
                showStatus("Open Flynn once to refresh access, then come back here.")
            } catch KeyboardDraftClient.ClientError.limitReached {
                showStatus("You're out of free drafts today — open Flynn to go unlimited.")
            } catch {
                showStatus("Network hiccup — tap ↻ Redraft to try again.")
                setIdleChrome(visible: true)
            }
        }
    }

    // MARK: Actions

    @objc private func onRedraft() {
        drafts = []
        hideBookingChip()
        if let shorthand = originalShorthand?.trimmingCharacters(in: .whitespacesAndNewlines),
           shorthand.count >= 8 {
            runCompose(text: shorthand)
        } else {
            showIdleState()
        }
    }

    @objc private func onInsert() {
        guard drafts.indices.contains(index) else { return }
        let draft = drafts[index]

        // Replace the typed shorthand when we can verify what we're deleting;
        // otherwise fall back to inserting at the cursor.
        if canReplace, let shorthand = originalShorthand, !shorthand.isEmpty {
            replaceTypedText(shorthand, with: draft)
        } else {
            textDocumentProxy.insertText(draft)
        }

        KeyboardDraftClient.recordAccepted(
            text: draft,
            source: currentSource,
            candidates: drafts,
            pickedIndex: index,
            messages: sourceMessages.isEmpty ? nil : sourceMessages
        )
        drafts = []
        originalShorthand = nil
        canReplace = false
        currentSource = "rewrite"
        sourceMessages = []
        // Save the event before hideBookingChip clears it.
        let calEvent = pendingEvent
        hideBookingChip()
        showStatus("Inserted ✓  — switch back to send.")
        setIdleChrome(visible: true)
        // Show the "Add to Google Calendar" chip below the status if we have a booking.
        if let event = calEvent {
            showPostInsertCalendarChip(for: event)
        }
    }

    /// Delete the operator's shorthand and insert the polished text in its place.
    ///
    /// `deleteBackward()` removes one *user-perceived* character per call and there
    /// is no bulk delete, so the count must come from `String.count` (graphemes) and
    /// not `utf16.count` — otherwise emoji and combining marks over-delete, and
    /// tradies use emoji.
    ///
    /// Some hosts (WebView- or React-Native-backed compose fields are the usual
    /// offenders) coalesce or drop rapid `deleteBackward()` calls, so this verifies
    /// against the proxy afterwards and makes bounded extra passes rather than
    /// trusting the first one. If it still can't clear the field it inserts a
    /// leading space instead of leaving the two texts jammed together.
    private func replaceTypedText(_ shorthand: String, with replacement: String) {
        // Hard ceiling on how much we will ever remove: exactly the shorthand we
        // read, capped. Tracking a running total (rather than re-deriving a count
        // each pass) is what stops a retry from eating text the operator had typed
        // BEFORE the shorthand.
        let target = min(shorthand.count, 600)
        var deleted = 0
        var pass = 0

        while deleted < target && pass < 3 {
            let before = textDocumentProxy.documentContextBeforeInput ?? ""
            if before.isEmpty { break }
            let want = min(target - deleted, before.count)
            if want == 0 { break }

            for _ in 0..<want {
                textDocumentProxy.deleteBackward()
            }

            // Verify rather than assume: hosts that coalesce or drop deletes report
            // it here. No progress means retrying won't help, so stop instead of
            // spinning (or worse, over-deleting on a later pass).
            let after = textDocumentProxy.documentContextBeforeInput ?? ""
            let actuallyDeleted = max(0, before.count - after.count)
            if actuallyDeleted == 0 { break }
            deleted += actuallyDeleted
            pass += 1
        }

        let leftover = textDocumentProxy.documentContextBeforeInput ?? ""
        let needsSpace = !leftover.isEmpty && !leftover.hasSuffix(" ") && !leftover.hasSuffix("\n")
        textDocumentProxy.insertText(needsSpace ? " " + replacement : replacement)
    }

    // MARK: Saved messages

    @objc private func onSavedTap() {
        if isShowingSaved { exitSavedMode() } else { enterSavedMode() }
    }

    private func enterSavedMode() {
        isShowingSaved = true
        savedButton.setTitle("Back", for: .normal)
        // Hide the draft surfaces; the saved list takes the flex slot.
        scrollView.isHidden = true
        pageControl.isHidden = true
        statusContainer.isHidden = true
        bookRow.isHidden = true
        setIdleChrome(visible: false)
        rebuildSavedCards(SharedStore.savedMessages)
        savedScroll.isHidden = false
    }

    private func exitSavedMode() {
        isShowingSaved = false
        savedButton.setTitle("Saved", for: .normal)
        savedScroll.isHidden = true
        if drafts.isEmpty {
            showIdleState()
        } else {
            showResults(); renderCard()
        }
    }

    /// Build one tappable card per saved message; tapping inserts its body.
    private func rebuildSavedCards(_ messages: [SavedMessage]) {
        savedStack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        guard !messages.isEmpty else {
            let empty = UILabel()
            empty.text = "No saved messages yet. Add them in the Flynn app under Settings → Quick messages."
            empty.numberOfLines = 0
            empty.textAlignment = .center
            empty.font = .systemFont(ofSize: 15, weight: .medium)
            empty.textColor = Self.cardText.withAlphaComponent(0.6)
            empty.translatesAutoresizingMaskIntoConstraints = false
            let wrap = UIView()
            wrap.addSubview(empty)
            NSLayoutConstraint.activate([
                empty.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: 20),
                empty.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: -20),
                empty.topAnchor.constraint(equalTo: wrap.topAnchor, constant: 24),
                empty.bottomAnchor.constraint(equalTo: wrap.bottomAnchor, constant: -24),
            ])
            savedStack.addArrangedSubview(wrap)
            return
        }

        for message in messages {
            let card = UIControl()
            card.backgroundColor = Self.cardBG
            card.layer.cornerRadius = 14
            card.layer.borderWidth = 2
            card.layer.borderColor = Self.cardBorder.resolvedColor(with: traitCollection).cgColor
            card.translatesAutoresizingMaskIntoConstraints = false
            card.addAction(UIAction { [weak self] _ in self?.insertSaved(message.body) }, for: .touchUpInside)

            let title = UILabel()
            title.text = message.title
            title.font = .systemFont(ofSize: 13, weight: .bold)
            title.textColor = Self.flynnOrange
            title.isUserInteractionEnabled = false
            title.translatesAutoresizingMaskIntoConstraints = false

            let body = UILabel()
            body.text = message.body
            body.numberOfLines = 3
            body.font = .systemFont(ofSize: 16, weight: .regular)
            body.textColor = Self.cardText
            body.isUserInteractionEnabled = false
            body.translatesAutoresizingMaskIntoConstraints = false

            card.addSubview(title)
            card.addSubview(body)
            NSLayoutConstraint.activate([
                title.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 14),
                title.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -14),
                title.topAnchor.constraint(equalTo: card.topAnchor, constant: 10),
                body.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 14),
                body.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -14),
                body.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 4),
                body.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -12),
            ])
            savedStack.addArrangedSubview(card)
        }
    }

    private func insertSaved(_ text: String) {
        textDocumentProxy.insertText(text)
        KeyboardDraftClient.recordAccepted(text: text, source: "chip")
        isShowingSaved = false
        savedButton.setTitle("Saved", for: .normal)
        savedScroll.isHidden = true
        drafts = []
        showStatus("Inserted ✓  — switch back to send.")
        setIdleChrome(visible: true)
    }
}
