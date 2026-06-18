import AppKit
import ApplicationServices

/// Reads the full conversation text from the frontmost app via AXUIElement.
/// Called on-invoke only — never runs in the background.
///
/// Returns complete off-screen text; the Accessibility API returns the full
/// text content of a control, not just the visible portion.
enum AXConversationReader {
    enum ReadError: Error {
        case accessDenied
        case noFocusedApp
        case noConversationFound
    }

    // MARK: - Public entry point

    static func capture(app providedApp: NSRunningApplication? = nil) throws -> ConversationContext {
        // Use the caller-provided app (captured before popup appeared) to avoid
        // NSWorkspace.frontmostApplication switching to Flynn's own panel.
        guard let app = providedApp ?? NSWorkspace.shared.frontmostApplication else {
            throw ReadError.noFocusedApp
        }

        let pid = app.processIdentifier
        let bundleID = app.bundleIdentifier ?? ""
        let appName = app.localizedName ?? bundleID

        let axApp = AXUIElementCreateApplication(pid)

        // Try targeted strategies for known apps first, then generic fallback.
        let messages: [String]
        if bundleID == "com.apple.MobileSMS" || bundleID == "com.apple.iChat" {
            messages = try readMessages(axApp: axApp)
        } else if bundleID == "com.tinyspeck.slackmacgap" {
            messages = try readSlack(axApp: axApp)
        } else if bundleID == "net.whatsapp.WhatsApp" {
            messages = try readScrollArea(axApp: axApp)
        } else {
            messages = try readGeneric(axApp: axApp)
        }

        guard !messages.isEmpty else { throw ReadError.noConversationFound }

        return ConversationContext(
            appName: appName,
            messages: messages,
            sourceType: .native,
            sourceBundleID: bundleID
        )
    }

    // MARK: - Messages.app

    private static func readMessages(axApp: AXUIElement) throws -> [String] {
        guard let window = firstWindow(of: axApp) else { return [] }

        // Strategy 1: Standard macOS Messages structure (List inside ScrollArea)
        if let scrollArea = findDescendant(of: window, role: kAXScrollAreaRole),
           let list = findDescendant(of: scrollArea, role: kAXListRole) {
            var results: [(text: String, y: CGFloat)] = []
            // Try group-based bubbles first (macOS 13/14)
            let groups = children(of: list, withRole: kAXGroupRole)
            for group in groups {
                let texts = collectStaticTexts(of: group)
                let combined = texts.joined(separator: " ")
                if !combined.isEmpty {
                    results.append((combined, frameY(of: group)))
                }
            }
            if !results.isEmpty {
                return results.sorted { $0.y < $1.y }.map(\.text).suffix(40)
                    .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            }
            // Fallback: read all static text directly from the list
            let allTexts = collectStaticTexts(of: list)
            if !allTexts.isEmpty {
                return Array(allTexts.suffix(40))
            }
        }

        // Strategy 2: Sequoia — Messages may use a different scroll structure; sweep whole window
        var allScrollAreas: [AXUIElement] = []
        collectDescendants(of: window, matchingRole: kAXScrollAreaRole, into: &allScrollAreas)
        let texts = allScrollAreas.flatMap { collectStaticTexts(of: $0) }
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        return Array(texts.suffix(40))
    }

    // MARK: - Slack

    private static func readSlack(axApp: AXUIElement) throws -> [String] {
        guard let window = firstWindow(of: axApp) else { return [] }
        // Slack message articles are AXGroup elements with role=AXArticle or
        // with an AXIdentifier containing "message"
        var articles: [AXUIElement] = []
        collectDescendants(of: window, matchingRole: "AXArticle", into: &articles)
        if articles.isEmpty {
            collectDescendants(of: window, matchingRole: kAXGroupRole, into: &articles)
        }

        return articles
            .compactMap { collectStaticTexts(of: $0).joined(separator: " ") }
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            .suffix(40)
    }

    // MARK: - WhatsApp Desktop and similar scroll-area apps

    private static func readScrollArea(axApp: AXUIElement) throws -> [String] {
        guard let window = firstWindow(of: axApp) else { return [] }
        var allTexts: [String] = []
        var scrollAreas: [AXUIElement] = []
        collectDescendants(of: window, matchingRole: kAXScrollAreaRole, into: &scrollAreas)

        for area in scrollAreas {
            let texts = collectStaticTexts(of: area)
            allTexts.append(contentsOf: texts)
        }

        return allTexts
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            .suffix(40)
    }

    // MARK: - Generic fallback: focused element value or nearest scroll area

    private static func readGeneric(axApp: AXUIElement) throws -> [String] {
        // Try focused element's full value first (works for text editors, chat inputs)
        var focusedRef: AnyObject?
        AXUIElementCopyAttributeValue(axApp, kAXFocusedUIElementAttribute as CFString, &focusedRef)
        if let focused = focusedRef, CFGetTypeID(focused as CFTypeRef) == AXUIElementGetTypeID() {
            let el = focused as! AXUIElement
            if let text = stringAttribute(of: el, key: kAXValueAttribute), !text.isEmpty {
                return splitIntoMessages(text)
            }
        }

        // Fall back to scroll area traversal
        return (try? readScrollArea(axApp: axApp)) ?? []
    }

    // MARK: - Focused field frame (for popup positioning)

    /// Returns the screen frame of the focused text input in the given app,
    /// converted to NSRect (bottom-left origin). Returns nil if not found.
    static func getFocusedFieldFrame(app: NSRunningApplication?) -> NSRect? {
        guard let app else { return nil }
        let axApp = AXUIElementCreateApplication(app.processIdentifier)

        var focusedRef: AnyObject?
        AXUIElementCopyAttributeValue(axApp, kAXFocusedUIElementAttribute as CFString, &focusedRef)
        guard let focusedRef,
              CFGetTypeID(focusedRef as CFTypeRef) == AXUIElementGetTypeID() else { return nil }
        let focused = focusedRef as! AXUIElement

        // Try the focused element itself, then walk up one level to its parent
        return axFrame(of: focused) ?? {
            var parentRef: AnyObject?
            AXUIElementCopyAttributeValue(focused, kAXParentAttribute as CFString, &parentRef)
            guard let parentRef, CFGetTypeID(parentRef as CFTypeRef) == AXUIElementGetTypeID() else { return nil }
            return axFrame(of: parentRef as! AXUIElement)
        }()
    }

    private static func axFrame(of el: AXUIElement) -> NSRect? {
        var posRef: AnyObject?
        var sizeRef: AnyObject?
        AXUIElementCopyAttributeValue(el, kAXPositionAttribute as CFString, &posRef)
        AXUIElementCopyAttributeValue(el, kAXSizeAttribute as CFString, &sizeRef)
        guard let posRef, let sizeRef else { return nil }

        var pos = CGPoint.zero
        var size = CGSize.zero
        AXValueGetValue(posRef as! AXValue, .cgPoint, &pos)
        AXValueGetValue(sizeRef as! AXValue, .cgSize, &size)
        guard size.width > 20, size.height > 10 else { return nil }

        // AX uses top-left origin; convert to NSRect (bottom-left origin via main screen height)
        let screenH = NSScreen.screens.first?.frame.height ?? 1080
        return NSRect(x: pos.x, y: screenH - pos.y - size.height, width: size.width, height: size.height)
    }

    // MARK: - AX helpers

    private static func firstWindow(of app: AXUIElement) -> AXUIElement? {
        var ref: AnyObject?
        AXUIElementCopyAttributeValue(app, kAXFocusedWindowAttribute as CFString, &ref)
        if let el = ref, CFGetTypeID(el as CFTypeRef) == AXUIElementGetTypeID() {
            return (el as! AXUIElement)
        }
        // Fallback: first main window
        var windowsRef: AnyObject?
        AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &windowsRef)
        guard let windows = windowsRef as? [AXUIElement], let first = windows.first else { return nil }
        return first
    }

    private static func findDescendant(of element: AXUIElement, role: String) -> AXUIElement? {
        if let r = stringAttribute(of: element, key: kAXRoleAttribute), r == role {
            return element
        }
        for child in children(of: element) {
            if let found = findDescendant(of: child, role: role) { return found }
        }
        return nil
    }

    private static func children(of element: AXUIElement, withRole role: String? = nil) -> [AXUIElement] {
        var ref: AnyObject?
        AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &ref)
        guard let list = ref as? [AXUIElement] else { return [] }
        if let role {
            return list.filter { stringAttribute(of: $0, key: kAXRoleAttribute) == role }
        }
        return list
    }

    private static func collectDescendants(
        of element: AXUIElement,
        matchingRole role: String,
        into results: inout [AXUIElement],
        depth: Int = 0
    ) {
        guard depth < 20 else { return }
        let r = stringAttribute(of: element, key: kAXRoleAttribute) ?? ""
        if r == role { results.append(element) }
        for child in children(of: element) {
            collectDescendants(of: child, matchingRole: role, into: &results, depth: depth + 1)
        }
    }

    private static func collectStaticTexts(of element: AXUIElement, depth: Int = 0) -> [String] {
        guard depth < 15 else { return [] }
        var results: [String] = []
        let role = stringAttribute(of: element, key: kAXRoleAttribute) ?? ""
        if role == kAXStaticTextRole || role == kAXTextAreaRole || role == kAXTextFieldRole {
            if let t = stringAttribute(of: element, key: kAXValueAttribute), !t.isEmpty {
                results.append(t)
            }
        }
        for child in children(of: element) {
            results.append(contentsOf: collectStaticTexts(of: child, depth: depth + 1))
        }
        return results
    }

    private static func stringAttribute(of element: AXUIElement, key: String) -> String? {
        var ref: AnyObject?
        let result = AXUIElementCopyAttributeValue(element, key as CFString, &ref)
        guard result == .success, let str = ref as? String else { return nil }
        return str
    }

    private static func frameY(of element: AXUIElement) -> CGFloat {
        var ref: AnyObject?
        AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &ref)
        guard let value = ref else { return 0 }
        var point = CGPoint.zero
        AXValueGetValue(value as! AXValue, .cgPoint, &point)
        return point.y
    }

    /// Split a multi-paragraph string into individual messages.
    private static func splitIntoMessages(_ text: String) -> [String] {
        text.components(separatedBy: "\n\n")
            .flatMap { $0.components(separatedBy: "\n") }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }
}
