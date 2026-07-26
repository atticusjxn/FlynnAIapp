import SwiftUI
import Supabase

/// Where the money lands.
///
/// Flynn's invoices are paid straight into the operator's own bank account —
/// no merchant account, no onboarding review, no percentage skimmed on the way
/// through. That makes this screen the whole "connect your bank" story: the
/// details entered here are exactly what `renderInvoiceHTML` prints on every
/// hosted invoice, so an invoice is payable the moment this is filled in.
///
/// Everything is stored on `users.business_brain`, the same loosely-typed jsonb
/// the SMS agent and the voice-funnel claim write to — hence the read-merge-write
/// through `JSONValue` rather than overwriting the column.
@MainActor
@Observable
final class PaymentDetailsStore {
    enum LoadState: Equatable { case idle, loading, loaded, error(String) }

    private(set) var loadState: LoadState = .idle
    private(set) var isSaving = false
    private(set) var isSearching = false
    private(set) var searchResults: [ABNLookup.Result] = []
    private(set) var searchFailed = false

    var businessName = ""
    var abn = ""
    var bsb = ""
    var accountNumber = ""
    var accountName = ""
    var payid = ""

    /// Every other key on business_brain, preserved untouched across a save.
    private var brain: [String: JSONValue] = [:]
    private var searchTask: Task<Void, Never>?
    private let client: SupabaseClient

    init(client: SupabaseClient = FlynnSupabase.client) {
        self.client = client
    }

    var canSearchByName: Bool { ABNLookup.isConfigured }

    /// Enough to actually get paid: a full BSB + account, or a PayID.
    var isPayable: Bool {
        (bsbDigits.count == 6 && accountDigits.count >= 5) || !payid.trimmed.isEmpty
    }

    var bsbDigits: String { bsb.filter(\.isNumber) }
    var accountDigits: String { accountNumber.filter(\.isNumber) }

    var bsbError: String? {
        guard !bsb.isEmpty, bsbDigits.count != 6 else { return nil }
        return "A BSB is 6 digits."
    }

    var accountError: String? {
        guard !accountNumber.isEmpty, accountDigits.count < 5 else { return nil }
        return "That looks too short for an account number."
    }

    func load() async {
        loadState = .loading
        struct Row: Decodable { let business_brain: JSONValue? }
        do {
            let session = try await client.auth.session
            let row: Row = try await client
                .from("users")
                .select("business_brain")
                .eq("id", value: session.user.id.uuidString)
                .single()
                .execute()
                .value

            brain = row.business_brain?.objectValue ?? [:]
            businessName = brain["business_name"]?.displayString ?? ""
            abn = brain["abn"]?.displayString ?? ""
            bsb = brain["bank_bsb"]?.displayString ?? ""
            accountNumber = brain["bank_account"]?.displayString ?? ""
            accountName = brain["bank_account_name"]?.displayString ?? ""
            payid = brain["payid"]?.displayString ?? ""
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }

    func save() async -> Bool {
        isSaving = true
        defer { isSaving = false }

        var updated = brain
        updated.setTrimmed("business_name", businessName)
        updated.setTrimmed("abn", abn)
        updated.setTrimmed("bank_bsb", bsb)
        updated.setTrimmed("bank_account", accountNumber)
        // An account name is required for a transfer to land, so fall back to
        // the business name rather than shipping an invoice without one.
        updated.setTrimmed("bank_account_name", accountName.trimmed.isEmpty ? businessName : accountName)
        updated.setTrimmed("payid", payid)

        struct Patch: Encodable { let business_brain: JSONValue }
        do {
            let session = try await client.auth.session
            try await client
                .from("users")
                .update(Patch(business_brain: .object(updated)))
                .eq("id", value: session.user.id.uuidString)
                .execute()
            brain = updated
            return true
        } catch {
            FlynnLog.network.error("savePaymentDetails failed: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    /// Debounced name search. Results clear as soon as an ABN is chosen.
    func searchByName(_ query: String) {
        searchTask?.cancel()
        guard canSearchByName, query.trimmed.count >= 3 else {
            searchResults = []
            isSearching = false
            return
        }
        searchTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled, let self else { return }
            self.isSearching = true
            self.searchFailed = false
            do {
                let results = try await ABNLookup.search(name: query)
                guard !Task.isCancelled else { return }
                self.searchResults = results
            } catch {
                guard !Task.isCancelled else { return }
                self.searchResults = []
                self.searchFailed = true
            }
            self.isSearching = false
        }
    }

    func choose(_ result: ABNLookup.Result) {
        businessName = result.name
        abn = result.formattedABN
        if accountName.trimmed.isEmpty { accountName = result.name }
        searchResults = []
        searchTask?.cancel()
    }

    func formatBSB(_ raw: String) {
        let digits = String(raw.filter(\.isNumber).prefix(6))
        bsb = digits.count > 3
            ? "\(digits.prefix(3))-\(digits.dropFirst(3))"
            : digits
    }

    func formatAccount(_ raw: String) {
        accountNumber = String(raw.filter(\.isNumber).prefix(10))
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}

struct PaymentDetailsView: View {
    @Environment(FlashStore.self) private var flash
    @State private var store = PaymentDetailsStore()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                header

                switch store.loadState {
                case .idle, .loading:
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 200)
                case .error(let message):
                    Text(message)
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.error)
                case .loaded:
                    businessSection
                    bankSection
                    payidSection
                    saveSection
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Getting paid")
        .navigationBarTitleDisplayMode(.large)
        .scrollDismissesKeyboard(.interactively)
        .task { await store.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            Text("Your bank details")
                .flynnType(FlynnTypography.overline)
                .foregroundColor(FlynnColor.textTertiary)
            Text("Money goes straight to you")
                .flynnType(FlynnTypography.h3)
                .foregroundColor(FlynnColor.textPrimary)
            Text("These sit on every invoice Flynn sends, so your client can pay the moment they open it. Nothing passes through Flynn and nothing gets taken out.")
                .flynnType(FlynnTypography.bodyMedium)
                .foregroundColor(FlynnColor.textSecondary)
        }
    }

    // MARK: - Business

    private var businessSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            sectionLabel("Your business")

            FlynnTextField(
                label: "Business name",
                text: Binding(
                    get: { store.businessName },
                    set: { value in
                        store.businessName = value
                        store.searchByName(value)
                    }
                ),
                placeholder: "Start typing and we'll find you",
                autocapitalization: .words,
                autocorrection: false,
                helperText: store.canSearchByName
                    ? "We'll look up your ABN from the business register."
                    : nil
            )

            if store.isSearching {
                HStack(spacing: FlynnSpacing.xs) {
                    ProgressView().controlSize(.small)
                    Text("Searching the business register…")
                        .flynnType(FlynnTypography.caption)
                        .foregroundColor(FlynnColor.textTertiary)
                }
            }

            if !store.searchResults.isEmpty {
                searchResultsList
            }

            if store.searchFailed {
                Text("Couldn't reach the business register. You can type your ABN in below.")
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            }

            FlynnTextField(
                label: "ABN",
                text: $store.abn,
                placeholder: "Optional",
                keyboardType: .numbersAndPunctuation,
                autocorrection: false,
                helperText: "Shown on your invoices. Tap a business above and we'll fill this in."
            )
        }
    }

    private var searchResultsList: some View {
        VStack(spacing: 0) {
            ForEach(Array(store.searchResults.enumerated()), id: \.element.id) { index, result in
                Button {
                    store.choose(result)
                } label: {
                    HStack(alignment: .top, spacing: FlynnSpacing.sm) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(result.name)
                                .flynnType(FlynnTypography.bodyMedium)
                                .foregroundColor(FlynnColor.textPrimary)
                                .multilineTextAlignment(.leading)
                            HStack(spacing: FlynnSpacing.xs) {
                                Text("ABN \(result.formattedABN)")
                                    .flynnType(FlynnTypography.caption)
                                    .foregroundColor(FlynnColor.textTertiary)
                                if !result.location.isEmpty {
                                    Text("· \(result.location)")
                                        .flynnType(FlynnTypography.caption)
                                        .foregroundColor(FlynnColor.textTertiary)
                                }
                                if !result.isActive {
                                    Text("· cancelled")
                                        .flynnType(FlynnTypography.caption)
                                        .foregroundColor(FlynnColor.warning)
                                }
                            }
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(FlynnColor.textTertiary)
                            .padding(.top, 4)
                    }
                    .padding(FlynnSpacing.sm)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if index < store.searchResults.count - 1 {
                    Divider().padding(.leading, FlynnSpacing.sm)
                }
            }
        }
        .background(
            RoundedRectangle(cornerRadius: FlynnRadii.md, style: .continuous)
                .fill(FlynnColor.backgroundSecondary)
        )
    }

    // MARK: - Bank

    private var bankSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            sectionLabel("Bank transfer")

            FlynnTextField(
                label: "BSB",
                text: Binding(
                    get: { store.bsb },
                    set: { store.formatBSB($0) }
                ),
                placeholder: "123-456",
                keyboardType: .numberPad,
                autocorrection: false,
                errorText: store.bsbError
            )

            FlynnTextField(
                label: "Account number",
                text: Binding(
                    get: { store.accountNumber },
                    set: { store.formatAccount($0) }
                ),
                placeholder: "12345678",
                keyboardType: .numberPad,
                autocorrection: false,
                errorText: store.accountError
            )

            FlynnTextField(
                label: "Account name",
                text: $store.accountName,
                placeholder: store.businessName.isEmpty ? "Your business or your name" : store.businessName,
                autocapitalization: .words,
                autocorrection: false,
                helperText: "Leave blank and we'll use your business name."
            )
        }
    }

    private var payidSection: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
            sectionLabel("PayID (optional)")
            FlynnTextField(
                label: "PayID",
                text: $store.payid,
                placeholder: "Your email or mobile",
                keyboardType: .emailAddress,
                autocapitalization: .never,
                autocorrection: false,
                helperText: "Most clients find a PayID quicker than a BSB. Add one if you've got it."
            )
        }
    }

    private var saveSection: some View {
        VStack(spacing: FlynnSpacing.sm) {
            FlynnGlassButton(
                title: "Save",
                action: {
                    Task {
                        let ok = await store.save()
                        flash.show(
                            ok ? "Saved. Your invoices can be paid now." : "Couldn't save that — try again.",
                            kind: ok ? .success : .error
                        )
                    }
                },
                isLoading: store.isSaving
            )

            if !store.isPayable {
                Label(
                    "Add a BSB and account number (or a PayID) so clients can actually pay you.",
                    systemImage: "exclamationmark.triangle"
                )
                .flynnType(FlynnTypography.caption)
                .foregroundColor(FlynnColor.textTertiary)
                .multilineTextAlignment(.leading)
            }
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .flynnType(FlynnTypography.overline)
            .foregroundColor(FlynnColor.textTertiary)
    }
}
