import SwiftUI
import UIKit

// MARK: - Keyboard dismissal
//
// Twelve screens with text input had no way off the keyboard once it was up —
// the entire Money form stack (invoice, quote, line item, client picker), the
// note fields, the setup-code field. On a phone that reads as the app being
// stuck. `Return` doesn't help on multi-line fields, and not every screen is a
// scroll view, so `.scrollDismissesKeyboard` alone doesn't cover it.
//
// `.dismissKeyboardOnTap()` adds a tap on the surrounding surface that resigns
// first responder. It's a *simultaneous* gesture, so it fires alongside taps on
// buttons and rows rather than swallowing them — tapping a Save button both
// saves and puts the keyboard away, which is what you want anyway.

extension View {
    /// Tap anywhere on this view's empty space to dismiss the keyboard. Safe to
    /// stack over interactive content — it recognises simultaneously and never
    /// blocks child controls.
    func dismissKeyboardOnTap() -> some View {
        simultaneousGesture(
            TapGesture().onEnded {
                KeyboardDismiss.resign()
            }
        )
    }
}

enum KeyboardDismiss {
    /// Resign whatever is first responder. UIKit's `endEditing` is more reliable
    /// than SwiftUI `FocusState` here because it works regardless of which field
    /// (or which framework's field) currently holds focus.
    static func resign() {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?
            .endEditing(true)
    }
}
