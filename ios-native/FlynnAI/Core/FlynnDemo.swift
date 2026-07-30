import Foundation

/// DEBUG-only demo mode: fills the app with believable fake data so every screen
/// can be looked at without a login or a network round trip.
///
/// Turn it on with the launch argument `-FlynnDemo` (Xcode: Product → Scheme →
/// Edit Scheme → Run → Arguments), or from the command line:
///
///     xcrun simctl launch <device> com.flynnai.app -FlynnDemo
///
/// It is compiled out of Release entirely — `isOn` is a hard `false` there, so
/// no fixture can reach a shipping build even if a repository forgets to guard.
/// Raised when a demo detail route points at an id with no fixture behind it.
enum FlynnDemoError: LocalizedError {
    case notFound
    var errorDescription: String? { "No demo fixture with that id." }
}

enum FlynnDemo {
    static let isOn: Bool = {
        #if DEBUG
        return ProcessInfo.processInfo.arguments.contains("-FlynnDemo")
        #else
        return false
        #endif
    }()

    /// Tab to open on launch, so any screen is reachable from the command line
    /// without tapping:  `xcrun simctl launch <dev> com.flynnai.app -FlynnDemo -FlynnDemoTab money`
    static var initialTab: FlynnTab? {
        #if DEBUG
        guard isOn else { return nil }
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-FlynnDemoTab"), i + 1 < args.count else { return nil }
        return FlynnTab(rawValue: args[i + 1])
        #else
        return nil
        #endif
    }

    /// Detail screen to push on launch, so screens behind a tap are reachable:
    ///   -FlynnDemo -FlynnDemoRoute invoice|quote|job|client
    /// iOS gates `simctl openurl` behind an "Open in Flynn?" alert that can't be
    /// dismissed from a screenshot, so deep links are no good for verification.
    static var initialRoute: Route? {
        #if DEBUG
        guard isOn else { return nil }
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-FlynnDemoRoute"), i + 1 < args.count else { return nil }
        switch args[i + 1] {
        case "invoice": return .invoiceDetail(id: ID.seeded(30))
        case "quote": return .quoteDetail(id: ID.seeded(40))
        case "job": return .eventDetail(id: ID.seeded(10))
        case "client": return .clientDetail(id: ID.seeded(1))
        default: return nil
        }
        #else
        return nil
        #endif
    }

    /// Stable ids so relationships line up across fixtures and SwiftUI doesn't
    /// re-animate rows on every reload.
    enum ID {
        static let org = UUID(uuidString: "0000A11A-0000-4000-8000-000000000001")!
        static let user = UUID(uuidString: "0000A11A-0000-4000-8000-000000000002")!
        static func seeded(_ n: Int) -> UUID {
            UUID(uuidString: String(format: "0000BEEF-0000-4000-8000-%012d", n))!
        }
    }

    private static func daysAgo(_ d: Double) -> Date { Date().addingTimeInterval(-d * 86_400) }
    private static func daysAhead(_ d: Double) -> Date { Date().addingTimeInterval(d * 86_400) }
    private static func hoursAgo(_ h: Double) -> Date { Date().addingTimeInterval(-h * 3_600) }
}

#if DEBUG
extension FlynnDemo {

    // MARK: - Clients

    static let clients: [ClientDTO] = [
        ClientDTO(id: ID.seeded(1), userId: ID.user, orgId: ID.org, name: "Dave Reilly",
                  phone: "+61412345678", email: "dave@example.com", address: "12 Oak St, Manly",
                  notes: "Gate code 4821. Dog in the yard.", businessType: nil,
                  preferredContactMethod: "sms", totalJobs: 4, lastJobDate: daysAgo(9),
                  lastJobType: "Blocked drain", createdAt: daysAgo(220), updatedAt: daysAgo(9)),
        ClientDTO(id: ID.seeded(2), userId: ID.user, orgId: ID.org, name: "Priya Nair",
                  phone: "+61498765432", email: nil, address: "3/88 Beach Rd, Curl Curl",
                  notes: nil, businessType: nil, preferredContactMethod: "sms",
                  totalJobs: 1, lastJobDate: daysAgo(2), lastJobType: "Hot water",
                  createdAt: daysAgo(30), updatedAt: daysAgo(2)),
        ClientDTO(id: ID.seeded(3), userId: ID.user, orgId: ID.org, name: "Molloy Builders",
                  phone: "+61455112233", email: "accounts@molloy.example", address: "Unit 4, 21 Harbord Rd",
                  notes: "Always pays on 30 days, chase at 21.", businessType: "Builder",
                  preferredContactMethod: "email", totalJobs: 11, lastJobDate: daysAgo(21),
                  lastJobType: "Rough-in", createdAt: daysAgo(500), updatedAt: daysAgo(21)),
        ClientDTO(id: ID.seeded(4), userId: ID.user, orgId: ID.org, name: "Sam Whitfield",
                  phone: "+61433990011", email: nil, address: "7 Pine Ave, Freshwater",
                  notes: nil, businessType: nil, preferredContactMethod: "call",
                  totalJobs: 2, lastJobDate: daysAgo(45), lastJobType: "Leaking tap",
                  createdAt: daysAgo(120), updatedAt: daysAgo(45)),
    ]

    // MARK: - Jobs

    static let events: [EventDTO] = [
        EventDTO(id: ID.seeded(10), clientName: "Dave Reilly", serviceType: "Blocked drain",
                 status: "scheduled", scheduledDate: daysAhead(0.2), scheduledTime: "2:00pm",
                 location: "12 Oak St, Manly", notes: "Water backing up in the laundry.",
                 createdAt: hoursAgo(2), clientId: ID.seeded(1), title: "Blocked drain",
                 scheduledAt: daysAhead(0.2)),
        EventDTO(id: ID.seeded(11), clientName: "Priya Nair", serviceType: "Hot water system",
                 status: "scheduled", scheduledDate: daysAhead(1), scheduledTime: "8:30am",
                 location: "3/88 Beach Rd, Curl Curl", notes: "Quoted for a 250L replacement.",
                 createdAt: daysAgo(2), clientId: ID.seeded(2), title: "Hot water system",
                 scheduledAt: daysAhead(1)),
        EventDTO(id: ID.seeded(12), clientName: "Molloy Builders", serviceType: "Rough-in",
                 status: "in-progress", scheduledDate: daysAhead(2), scheduledTime: "7:00am",
                 location: "Unit 4, 21 Harbord Rd", notes: "Second fix, bring the 40mm.",
                 createdAt: daysAgo(6), clientId: ID.seeded(3), title: "Rough-in stage 2",
                 scheduledAt: daysAhead(2)),
        EventDTO(id: ID.seeded(13), clientName: "Sam Whitfield", serviceType: "Leaking tap",
                 status: "completed", scheduledDate: daysAgo(3), scheduledTime: "11:00am",
                 location: "7 Pine Ave, Freshwater", notes: nil,
                 createdAt: daysAgo(5), clientId: ID.seeded(4), title: "Leaking tap",
                 scheduledAt: daysAgo(3)),
    ]

    // MARK: - Calls the receptionist took

    static let calls: [CallDTO] = [
        CallDTO(id: ID.seeded(20), userId: ID.user, callSid: "CA1", fromNumber: "+61412345678",
                toNumber: "+61480891471", status: "completed", duration: 48,
                recordingUrl: "https://example.com/r1.mp3", recordingSid: "RE1",
                transcriptionText: "Blocked drain at 12 Oak Street, water's backing up in the laundry. Asked if someone could come today — said an afternoon would work.",
                transcriptionConfidence: 0.94, jobId: ID.seeded(10),
                createdAt: hoursAgo(2), updatedAt: hoursAgo(2)),
        CallDTO(id: ID.seeded(21), userId: ID.user, callSid: "CA2", fromNumber: "+61455112233",
                toNumber: "+61480891471", status: "completed", duration: 96,
                recordingUrl: "https://example.com/r2.mp3", recordingSid: "RE2",
                transcriptionText: "Molloy Builders chasing the rough-in invoice, said accounts hasn't seen it. Wants it resent to accounts@molloy.example.",
                transcriptionConfidence: 0.91, jobId: nil,
                createdAt: hoursAgo(7), updatedAt: hoursAgo(7)),
        CallDTO(id: ID.seeded(22), userId: ID.user, callSid: "CA3", fromNumber: "+61433990011",
                toNumber: "+61480891471", status: "no-answer", duration: 8,
                recordingUrl: nil, recordingSid: nil, transcriptionText: nil,
                transcriptionConfidence: nil, jobId: nil,
                createdAt: hoursAgo(26), updatedAt: hoursAgo(26)),
    ]

    // MARK: - Brain

    /// A filled-in Brain. Every other screen seeds fixtures, but this one didn't,
    /// so demo mode rendered a blank form — which is how an empty form ended up
    /// on the App Store slide headlined "No forms".
    ///
    /// Deliberately the same trade and prices as the rest of the fixtures, so a
    /// capture of the Brain and a capture of an invoice tell one story.
    struct Brain {
        var businessType = "Plumber"
        var businessDescription =
            "Second-generation plumber on the Northern Beaches. Blocked drains, hot water and "
            + "bathroom work, mostly repeat customers and a few builders."
        var pricingNotes = "$90 callout, quotes free, card and bank transfer both fine"
        var serviceArea = "Northern Beaches, North Shore"
        var websiteURL = "reillyplumbing.com.au"
        var services: [(name: String, priceRange: String, duration: String)] = [
            ("Blocked drains", "$180–$400", "1–2 hrs"),
            ("Hot water systems", "from $2,100", "half day"),
            ("Bathroom rough-in", "$3,500–$6,000", "2–3 days"),
            ("Leaking taps & toilets", "$140–$260", "under an hour"),
        ]
        /// Mon–Fri open, weekend closed — the shape most trades actually run.
        var openDays: [String: (open: String, close: String)] = [
            "monday": ("07:00", "16:00"), "tuesday": ("07:00", "16:00"),
            "wednesday": ("07:00", "16:00"), "thursday": ("07:00", "16:00"),
            "friday": ("07:00", "15:00"),
        ]
    }

    static let brain = Brain()

    // MARK: - Brain voice fill

    /// Stands in for the parse endpoint so the confirmation flow can be driven
    /// end to end without a backend. Echoes a couple of things back from what
    /// was actually said so it doesn't feel canned.
    static func brainProposals(for transcript: String) -> [BrainVoiceFill.Proposal] {
        let said = transcript.lowercased()
        var out: [BrainVoiceFill.Proposal] = [
            .init(field: .businessType, value: said.contains("electric") ? "Electrician" : "Plumber"),
            .init(field: .pricingNotes, value: "$90 callout, quotes free"),
            .init(field: .hours, value: "Mon 7:00–16:00, Tue 7:00–16:00, Wed 7:00–16:00, Thu 7:00–16:00, Fri 7:00–16:00"),
            .init(field: .serviceArea, value: "Northern Beaches, North Shore"),
        ]
        out.append(.init(field: .service, value: "Blocked drains", detail: "$180–$400 · 1–2 hrs"))
        out.append(.init(field: .service, value: "Hot water systems", detail: "from $2,100 · half day"))
        if said.count > 60 {
            out.append(.init(field: .businessDescription, value: transcript))
        }
        return out
    }

    // MARK: - Money

    private static func items(_ pairs: [(String, Double, Double)]) -> [LineItem] {
        pairs.enumerated().map { i, p in
            LineItem(id: ID.seeded(900 + i), description: p.0, quantity: p.1,
                     unitPrice: p.2, total: p.1 * p.2)
        }
    }

    /// Deliberately spans every status the Money screens branch on: overdue,
    /// sent, partial, paid, draft — so one launch shows all of them.
    static let invoices: [InvoiceDTO] = [
        InvoiceDTO(id: ID.seeded(30), orgId: ID.org, invoiceNumber: "INV-1042",
                   title: "Rough-in stage 2", clientId: ID.seeded(3), jobId: ID.seeded(12), quoteId: nil,
                   lineItems: items([("Rough-in labour", 12, 95), ("40mm PVC", 8, 22.5)]),
                   subtotal: 1320, taxRate: 10, taxAmount: 132, total: 1452,
                   amountPaid: 0, amountDue: 1452, status: "overdue", notes: nil, terms: nil,
                   dueDate: daysAgo(9), issuedDate: daysAgo(39),
                   stripePaymentLinkUrl: nil, pdfUrl: nil, sentAt: daysAgo(39),
                   viewedAt: daysAgo(38), paidAt: nil, paymentMethod: nil,
                   applicationFeeCents: nil, paidAmountCents: nil, payidReference: nil,
                   createdAt: daysAgo(39), updatedAt: daysAgo(38)),
        InvoiceDTO(id: ID.seeded(31), orgId: ID.org, invoiceNumber: "INV-1051",
                   title: "Hot water replacement", clientId: ID.seeded(2), jobId: ID.seeded(11), quoteId: nil,
                   lineItems: items([("250L system supply + install", 1, 2100)]),
                   subtotal: 2100, taxRate: 10, taxAmount: 210, total: 2310,
                   amountPaid: 0, amountDue: 2310, status: "sent", notes: nil, terms: nil,
                   dueDate: daysAhead(11), issuedDate: daysAgo(3),
                   stripePaymentLinkUrl: "https://pay.example/inv1051", pdfUrl: nil,
                   sentAt: daysAgo(3), viewedAt: daysAgo(2), paidAt: nil, paymentMethod: nil,
                   applicationFeeCents: nil, paidAmountCents: nil, payidReference: nil,
                   createdAt: daysAgo(3), updatedAt: daysAgo(2)),
        InvoiceDTO(id: ID.seeded(32), orgId: ID.org, invoiceNumber: "INV-1048",
                   title: "Blocked drain callout", clientId: ID.seeded(1), jobId: ID.seeded(10), quoteId: nil,
                   lineItems: items([("Emergency callout", 1, 180), ("Jetting", 2, 140)]),
                   subtotal: 460, taxRate: 10, taxAmount: 46, total: 506,
                   amountPaid: 200, amountDue: 306, status: "partial", notes: nil, terms: nil,
                   dueDate: daysAhead(4), issuedDate: daysAgo(6),
                   stripePaymentLinkUrl: nil, pdfUrl: nil, sentAt: daysAgo(6),
                   viewedAt: daysAgo(6), paidAt: nil, paymentMethod: nil,
                   applicationFeeCents: nil, paidAmountCents: 20000, payidReference: nil,
                   createdAt: daysAgo(6), updatedAt: daysAgo(1)),
        InvoiceDTO(id: ID.seeded(33), orgId: ID.org, invoiceNumber: "INV-1039",
                   title: "Leaking tap", clientId: ID.seeded(4), jobId: ID.seeded(13), quoteId: nil,
                   lineItems: items([("Callout + washer", 1, 140)]),
                   subtotal: 140, taxRate: 10, taxAmount: 14, total: 154,
                   amountPaid: 154, amountDue: 0, status: "paid", notes: nil, terms: nil,
                   dueDate: daysAgo(10), issuedDate: daysAgo(24),
                   stripePaymentLinkUrl: nil, pdfUrl: nil, sentAt: daysAgo(24),
                   viewedAt: daysAgo(23), paidAt: daysAgo(2), paymentMethod: "card",
                   applicationFeeCents: 150, paidAmountCents: 15400, payidReference: "PAY-1039",
                   createdAt: daysAgo(24), updatedAt: daysAgo(2)),
        InvoiceDTO(id: ID.seeded(34), orgId: ID.org, invoiceNumber: "INV-1052",
                   title: "Bathroom re-pipe (draft)", clientId: ID.seeded(3), jobId: nil, quoteId: nil,
                   lineItems: items([("Labour", 16, 95)]),
                   subtotal: 1520, taxRate: 10, taxAmount: 152, total: 1672,
                   amountPaid: 0, amountDue: 1672, status: "draft", notes: nil, terms: nil,
                   dueDate: daysAhead(30), issuedDate: Date(),
                   stripePaymentLinkUrl: nil, pdfUrl: nil, sentAt: nil,
                   viewedAt: nil, paidAt: nil, paymentMethod: nil,
                   applicationFeeCents: nil, paidAmountCents: nil, payidReference: nil,
                   createdAt: Date(), updatedAt: Date()),
    ]

    /// Payments recorded during a demo run, keyed by invoice. Demo fixtures are
    /// `let` constants, so this is the overlay that lets the money loop actually
    /// close on screen: mark an invoice paid and watch the "owed" figure drop.
    /// Process-lifetime only — a relaunch is back to the fixture state.
    nonisolated(unsafe) private static var demoPayments: [UUID: Double] = [:]
    private static let demoPaymentsLock = NSLock()

    /// Fixtures with any demo-run payments applied. Everything that reads
    /// invoices goes through here so one screen can't disagree with another.
    static var invoicesWithPayments: [InvoiceDTO] {
        demoPaymentsLock.lock()
        let payments = demoPayments
        demoPaymentsLock.unlock()
        guard !payments.isEmpty else { return invoices }
        return invoices.map { inv in
            guard let extra = payments[inv.id] else { return inv }
            var copy = inv
            let paid = min(inv.amountPaid + extra, inv.total)
            let due = max(inv.total - paid, 0)
            copy.amountPaid = paid
            copy.amountDue = due
            copy.status = due <= 0.005 ? "paid" : "partial"
            copy.paidAt = due <= 0.005 ? Date() : inv.paidAt
            return copy
        }
    }

    static func markInvoicePaid(id: UUID, amount: Double, method: String?) throws -> InvoiceDTO {
        guard invoices.contains(where: { $0.id == id }) else { throw FlynnDemoError.notFound }
        demoPaymentsLock.lock()
        demoPayments[id, default: 0] += amount
        demoPaymentsLock.unlock()
        guard let updated = invoicesWithPayments.first(where: { $0.id == id }) else {
            throw FlynnDemoError.notFound
        }
        return updated
    }

    static let quotes: [QuoteDTO] = [
        QuoteDTO(id: ID.seeded(40), orgId: ID.org, quoteNumber: "QUO-204",
                 title: "Bathroom re-pipe", clientId: ID.seeded(3), jobId: nil,
                 lineItems: items([("Labour", 16, 95), ("Copper + fittings", 1, 640)]),
                 subtotal: 2160, taxRate: 10, taxAmount: 216, total: 2376,
                 status: "sent", notes: nil, terms: "Valid 30 days.",
                 validUntil: daysAhead(24), stripePaymentLinkUrl: nil, pdfUrl: nil,
                 sentAt: daysAgo(6), sentTo: "accounts@molloy.example", viewedAt: daysAgo(5),
                 acceptedAt: nil, declinedAt: nil, createdAt: daysAgo(6), updatedAt: daysAgo(5)),
        QuoteDTO(id: ID.seeded(41), orgId: ID.org, quoteNumber: "QUO-201",
                 title: "Hot water replacement", clientId: ID.seeded(2), jobId: nil,
                 lineItems: items([("250L system supply + install", 1, 2100)]),
                 subtotal: 2100, taxRate: 10, taxAmount: 210, total: 2310,
                 status: "accepted", notes: nil, terms: nil,
                 validUntil: daysAhead(9), stripePaymentLinkUrl: nil, pdfUrl: nil,
                 sentAt: daysAgo(12), sentTo: "+61498765432", viewedAt: daysAgo(11),
                 acceptedAt: daysAgo(10), declinedAt: nil, createdAt: daysAgo(12), updatedAt: daysAgo(10)),
        QuoteDTO(id: ID.seeded(42), orgId: ID.org, quoteNumber: "QUO-198",
                 title: "Laundry reno rough-in", clientId: ID.seeded(4), jobId: nil,
                 lineItems: items([("Labour", 6, 95)]),
                 subtotal: 570, taxRate: 10, taxAmount: 57, total: 627,
                 status: "declined", notes: nil, terms: nil,
                 validUntil: daysAgo(3), stripePaymentLinkUrl: nil, pdfUrl: nil,
                 sentAt: daysAgo(20), sentTo: "+61433990011", viewedAt: daysAgo(19),
                 acceptedAt: nil, declinedAt: daysAgo(14), createdAt: daysAgo(20), updatedAt: daysAgo(14)),
    ]
}
#endif
