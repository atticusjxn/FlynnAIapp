import Foundation
import Security

/// Keychain store scoped to the shared access group so the sandboxed keyboard
/// extension can read the long-lived JWT the main app mints for it. Distinct from
/// `FlynnKeychain` (app-only, no access group) so existing items are untouched.
enum SharedSecureStore {
    private static let accessGroup = FlynnShared.keychainAccessGroup
    private static let service = "com.flynnai.app.shared"

    static func set(_ string: String, for account: String) {
        guard let data = string.data(using: .utf8) else { return }
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup
        ]
        SecItemDelete(base as CFDictionary)

        var attributes = base
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func string(for account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup
        ]
        SecItemDelete(query as CFDictionary)
    }

    // MARK: Convenience

    static var keyboardToken: String? {
        string(for: FlynnShared.keyboardTokenAccount)
    }

    static func setKeyboardToken(_ token: String) {
        set(token, for: FlynnShared.keyboardTokenAccount)
    }
}
