import AppKit
import SwiftUI

/// The floating non-activating popup panel that shows reply drafts.
/// Uses NSPanel so it stays above other apps without stealing focus.
final class DraftPopupWindow: NSPanel {
    private(set) var viewModel: DraftPopupViewModel

    // Global monitor for outside-click dismissal
    private var globalClickMonitor: Any?

    init(viewModel: DraftPopupViewModel) {
        self.viewModel = viewModel
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 480, height: 200),
            styleMask: [.nonactivatingPanel, .fullSizeContentView, .titled, .closable],
            backing: .buffered,
            defer: false
        )
        configure()
        setContentView()
    }

    private func configure() {
        level = .floating
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        hidesOnDeactivate = false
        isFloatingPanel = true
        isMovableByWindowBackground = true
        titlebarAppearsTransparent = true
        titleVisibility = .hidden
        backgroundColor = .clear
        isOpaque = false
        hasShadow = true
    }

    private func setContentView() {
        contentView = NSHostingView(rootView:
            DraftPopupView(viewModel: viewModel)
                .environment(\.colorScheme, effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua ? .dark : .light)
        )
    }

    // MARK: - Show / hide

    /// Positions the popup adjacent to the focused text field.
    /// Priority: right of field → above field → bottom-center of screen.
    func showNearTextField(_ fieldFrame: NSRect?) {
        let screen = NSScreen.main ?? NSScreen.screens[0]
        let sv = screen.visibleFrame
        let pw: CGFloat = 420
        let ph: CGFloat = 220
        let gap: CGFloat = 10

        var x: CGFloat
        var y: CGFloat

        if let f = fieldFrame {
            // Prefer right of the field, vertically centered on it
            let rightX = f.maxX + gap
            let centeredY = f.midY - ph / 2

            if rightX + pw <= sv.maxX - 8 {
                // Enough space to the right
                x = rightX
                y = centeredY
            } else {
                // Not enough room right — float above the field, right-aligned
                x = f.maxX - pw
                y = f.maxY + gap
            }
        } else {
            // No field found — bottom-center fallback
            x = sv.midX - pw / 2
            y = sv.minY + 80
        }

        // Clamp to visible screen
        x = max(sv.minX + 8, min(x, sv.maxX - pw - 8))
        y = max(sv.minY + 8, min(y, sv.maxY - ph - 8))

        setFrame(NSRect(x: x, y: y, width: pw, height: ph), display: false)
        alphaValue = 0
        makeKeyAndOrderFront(nil)
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.15
            ctx.timingFunction = CAMediaTimingFunction(name: .easeOut)
            animator().alphaValue = 1
        }
        startOutsideClickMonitor()
    }

    func hide() {
        stopOutsideClickMonitor()
        orderOut(nil)
    }

    // MARK: - Outside-click dismissal

    private func startOutsideClickMonitor() {
        stopOutsideClickMonitor()
        globalClickMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] event in
            guard let self else { return }
            let loc = event.locationInWindow
            let screenLoc = NSEvent.mouseLocation
            if !self.frame.contains(screenLoc) {
                self.hide()
                self.viewModel.dismiss()
            }
        }
    }

    private func stopOutsideClickMonitor() {
        if let monitor = globalClickMonitor {
            NSEvent.removeMonitor(monitor)
            globalClickMonitor = nil
        }
    }

    deinit { stopOutsideClickMonitor() }
}
