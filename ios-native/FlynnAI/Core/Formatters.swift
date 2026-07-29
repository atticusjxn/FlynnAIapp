import Foundation

enum FlynnFormatter {
    // MARK: Currency

    private static let currencyFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.maximumFractionDigits = 2
        f.minimumFractionDigits = 2
        return f
    }()

    /// Default currency for FlynnAI's home market. Pass an explicit `code:` to
    /// any formatter call to override per-invoice/quote.
    static let defaultCurrencyCode = "AUD"

    /// Formats a numeric value as localized currency. Accepts `Decimal`, `Double`,
    /// or any `BinaryFloatingPoint` — use the overloads below.
    static func currency(_ value: Decimal, code: String = defaultCurrencyCode) -> String {
        currencyFormatter.currencyCode = code
        return currencyFormatter.string(from: value as NSDecimalNumber) ?? "\(value)"
    }

    static func currency(_ value: Double, code: String = defaultCurrencyCode) -> String {
        currency(Decimal(value), code: code)
    }

    // MARK: Phone

    /// Light pretty-print for phone numbers.
    /// Falls back to the raw input for unrecognized shapes so we never hide data.
    ///
    /// AU and NZ are handled explicitly because they're the beachhead markets and
    /// their country codes are two digits. The old rule assumed a one-digit
    /// country code for anything 11 digits long, which turned the AU mobile
    /// +61498765432 into "+6 (149) 876-5432".
    static func phone(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "" }
        let digits = raw.filter { $0.isNumber }

        // +61 — Australia. 9 national digits.
        if digits.hasPrefix("61"), digits.count == 11 {
            let n = Array(digits.dropFirst(2))
            // Mobiles start with 4 and group 3-3-3; landlines are 1-4-4.
            if n.first == "4" {
                return "+61 \(String(n[0..<3])) \(String(n[3..<6])) \(String(n[6..<9]))"
            }
            return "+61 \(n[0]) \(String(n[1..<5])) \(String(n[5..<9]))"
        }

        // +64 — New Zealand. 8 or 9 national digits.
        if digits.hasPrefix("64"), digits.count == 10 || digits.count == 11 {
            let n = Array(digits.dropFirst(2))
            if n.count == 9 {
                return "+64 \(String(n[0..<2])) \(String(n[2..<5])) \(String(n[5..<9]))"
            }
            return "+64 \(n[0]) \(String(n[1..<4])) \(String(n[4..<8]))"
        }

        switch digits.count {
        case 10:
            let area = digits.prefix(3)
            let mid = digits.dropFirst(3).prefix(3)
            let end = digits.dropFirst(6)
            return "(\(area)) \(mid)-\(end)"
        case 11 where digits.hasPrefix("1"):
            let area = digits.dropFirst(1).prefix(3)
            let mid = digits.dropFirst(4).prefix(3)
            let end = digits.dropFirst(7)
            return "+1 (\(area)) \(mid)-\(end)"
        default:
            // Better to show a correct E.164 number than a confidently wrong
            // grouping for a country we don't have a rule for.
            return raw
        }
    }

    // MARK: Relative date

    nonisolated(unsafe) private static let relativeDateFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f
    }()

    /// "2d ago", "in 3h", etc.
    static func relativeDate(_ date: Date?, relativeTo reference: Date = Date()) -> String {
        guard let date else { return "" }
        return relativeDateFormatter.localizedString(for: date, relativeTo: reference)
    }

    // MARK: Duration

    /// Formats seconds as "3m 42s" / "45s" / "1h 5m".
    static func duration(seconds: Int?) -> String {
        guard let seconds, seconds > 0 else { return "0s" }
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        if h > 0 { return "\(h)h \(m)m" }
        if m > 0 { return "\(m)m \(s)s" }
        return "\(s)s"
    }
}
