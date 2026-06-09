import SwiftUI

struct CaptureHistoryView: View {
    @State private var captures: [ScreenshotCaptureDTO] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var expanded: String?

    var body: some View {
        Group {
            if isLoading && captures.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if captures.isEmpty {
                ContentUnavailableView(
                    "No captures yet",
                    systemImage: "camera.viewfinder",
                    description: Text("Use your gesture to capture a conversation and Flynn will show the history here.")
                )
            } else {
                List(captures) { capture in
                    CaptureRow(capture: capture, isExpanded: expanded == capture.id) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            expanded = expanded == capture.id ? nil : capture.id
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Captures")
        .task { await load() }
        .refreshable { await load() }
        .alert("Error", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let session = try await FlynnSupabase.client.auth.session
            var req = URLRequest(url: FlynnEnv.flynnAPIBaseURL.appendingPathComponent("api/brain/captures"), timeoutInterval: 15)
            req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            let (data, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                errorMessage = "Couldn't load captures."
                return
            }
            struct Resp: Decodable {
                let captures: [ScreenshotCaptureDTO]
            }
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .custom { decoder in
                let str = try decoder.singleValueContainer().decode(String.self)
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let d = formatter.date(from: str) { return d }
                formatter.formatOptions = [.withInternetDateTime]
                if let d = formatter.date(from: str) { return d }
                throw DecodingError.dataCorruptedError(in: try decoder.singleValueContainer(),
                    debugDescription: "Cannot decode date: \(str)")
            }
            captures = try decoder.decode(Resp.self, from: data).captures
        } catch {
            errorMessage = "Couldn't load captures."
        }
    }
}

private struct CaptureRow: View {
    let capture: ScreenshotCaptureDTO
    let isExpanded: Bool
    let onTap: () -> Void

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
            HStack {
                Text(Self.dateFormatter.string(from: capture.createdAt))
                    .flynnType(FlynnTypography.caption)
                    .foregroundColor(FlynnColor.textSecondary)
                Spacer()
                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .font(.caption)
                    .foregroundColor(FlynnColor.textTertiary)
            }
            if let summary = capture.summary, !summary.isEmpty {
                Text(summary)
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textPrimary)
            }
            if isExpanded, let text = capture.extractedText, !text.isEmpty {
                Text(text)
                    .flynnType(FlynnTypography.bodySmall)
                    .foregroundColor(FlynnColor.textSecondary)
                    .padding(.top, FlynnSpacing.xxs)
            }
        }
        .padding(.vertical, FlynnSpacing.xxs)
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}
