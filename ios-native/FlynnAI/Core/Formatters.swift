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

    /// Formats a numeric value as localized currency. Accepts `Decimal`, `Double`,
    /// or any `BinaryFloatingPoint` — use the overloads below.
    static func currency(_ value: Decimal, code: String = "USD") -> String {
        currencyFormatter.currencyCode = code
        return currencyFormatter.string(from: value as NSDecimalNumber) ?? "\(value)"
    }

    static func currency(_ value: Double, code: String = "USD") -> String {
        currency(Decimal(value), code: code)
    }

    // MARK: Phone

    /// Light pretty-print for phone numbers. E.164 "+15551234567" → "+1 (555) 123-4567".
    /// Falls back to the raw input for unrecognized shapes so we never hide data.
    static func phone(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "" }
        let digits = raw.filter { $0.isNumber }

        switch digits.count {
        case 10:
            let area = digits.prefix(3)
            let mid = digits.dropFirst(3).prefix(3)
            let end = digits.dropFirst(6)
            return "(\(area)) \(mid)-\(end)"
        case 11:
            let country = digits.prefix(1)
            let area = digits.dropFirst(1).prefix(3)
            let mid = digits.dropFirst(4).prefix(3)
            let end = digits.dropFirst(7)
            return "+\(country) (\(area)) \(mid)-\(end)"
        default:
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
