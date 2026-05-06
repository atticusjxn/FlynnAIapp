import Foundation
import AdServices
import Supabase

@MainActor
final class AppleSearchAdsAttributionStore {
    private struct PendingAttribution: Codable {
        var token: String
        var capturedAt: Date
        var claimStatus: ClaimStatus
        var retryCount: Int
    }

    private enum ClaimStatus: String, Codable {
        case pending
        case claimed
    }

    private struct ClaimPayload: Encodable {
        let token: String
        let tokenCapturedAt: String
        let appVersion: String
        let buildNumber: String
    }

    private static let keychainKey = "apple-search-ads.pending-attribution"
    private static let lastClaimedAtKey = "apple-search-ads.last-claimed-at"
    private static let maxTokenAge: TimeInterval = 24 * 60 * 60

    private let client: SupabaseClient
    private let urlSession: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let isoFormatter = ISO8601DateFormatter()

    init(
        client: SupabaseClient = FlynnSupabase.client,
        urlSession: URLSession = .shared
    ) {
        self.client = client
        self.urlSession = urlSession
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    func captureIfNeeded() async {
        guard !hasClaimedRecently() else { return }
        guard loadPending()?.claimStatus != .claimed else { return }

        if let pending = loadPending() {
            if isExpired(pending) {
                clearPending()
            } else {
                return
            }
        }

        do {
            let token = try AAAttribution.attributionToken()
            let pending = PendingAttribution(
                token: token,
                capturedAt: Date(),
                claimStatus: .pending,
                retryCount: 0
            )
            save(pending)
        } catch {
            FlynnLog.network.info("Apple Search Ads attribution token unavailable: \(error.localizedDescription, privacy: .public)")
        }
    }

    func claimIfAuthenticated() async {
        guard var pending = loadPending(), pending.claimStatus == .pending else { return }

        if isExpired(pending) {
            clearPending()
            return
        }

        do {
            let session = try await client.auth.session
            var request = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/attribution/apple-search-ads/claim"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            request.httpBody = try JSONEncoder().encode(
                ClaimPayload(
                    token: pending.token,
                    tokenCapturedAt: isoFormatter.string(from: pending.capturedAt),
                    appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown",
                    buildNumber: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "unknown"
                )
            )

            let (_, response) = try await urlSession.data(for: request)
            guard let http = response as? HTTPURLResponse else { return }

            if (200..<300).contains(http.statusCode) {
                markClaimed()
                clearPending()
                return
            }

            if http.statusCode >= 500 || http.statusCode == 408 || http.statusCode == 429 {
                pending.retryCount += 1
                save(pending)
            } else {
                FlynnLog.network.error("Apple Search Ads claim rejected with \(http.statusCode, privacy: .public)")
            }
        } catch {
            pending.retryCount += 1
            save(pending)
            FlynnLog.network.info("Apple Search Ads claim deferred: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func loadPending() -> PendingAttribution? {
        guard let data = FlynnKeychain.data(for: Self.keychainKey) else { return nil }
        return try? decoder.decode(PendingAttribution.self, from: data)
    }

    private func save(_ pending: PendingAttribution) {
        do {
            let data = try encoder.encode(pending)
            try FlynnKeychain.set(data, for: Self.keychainKey)
        } catch {
            FlynnLog.network.error("Failed to persist Apple Search Ads attribution state: \(error.localizedDescription, privacy: .public)")
        }
    }

    private func clearPending() {
        FlynnKeychain.delete(key: Self.keychainKey)
    }

    private func isExpired(_ pending: PendingAttribution) -> Bool {
        Date().timeIntervalSince(pending.capturedAt) > Self.maxTokenAge
    }

    private func hasClaimedRecently() -> Bool {
        guard let raw = UserDefaults.standard.object(forKey: Self.lastClaimedAtKey) as? Date else {
            return false
        }
        return Date().timeIntervalSince(raw) <= Self.maxTokenAge
    }

    private func markClaimed() {
        UserDefaults.standard.set(Date(), forKey: Self.lastClaimedAtKey)
    }
}
