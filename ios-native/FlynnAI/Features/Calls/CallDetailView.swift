import SwiftUI

struct CallDetailView: View {
    let callId: UUID
    @Environment(\.openURL) private var openURL

    @State private var call: CallDTO?
    @State private var errorMessage: String?
    @State private var isLoading = true

    private let repository: CallsRepositoryType = CallsRepository()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FlynnSpacing.lg) {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.top, FlynnSpacing.xl)
                } else if let call {
                    headerCard(call: call)
                    if call.hasTranscript {
                        transcriptCard(call: call)
                    }
                    if call.hasRecording {
                        recordingCard(call: call)
                    }
                    if let jobId = call.jobId {
                        NavigationLink(value: Route.eventDetail(id: jobId)) {
                            linkedEventCard
                        }
                        .buttonStyle(FlynnPressable())
                    }
                } else if let errorMessage {
                    ContentUnavailableView(
                        "Couldn't load call",
                        systemImage: "exclamationmark.triangle",
                        description: Text(errorMessage)
                    )
                }
            }
            .padding(FlynnSpacing.lg)
        }
        .background(FlynnColor.background)
        .navigationTitle("Call")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func headerCard(call: CallDTO) -> some View {
        FlynnCard {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                HStack(alignment: .firstTextBaseline) {
                    Text(FlynnFormatter.phone(call.fromNumber))
                        .flynnType(FlynnTypography.h2)
                    Spacer()
                    CallStatusBadge(status: call.status)
                }
                if let to = call.toNumber {
                    Label("To \(FlynnFormatter.phone(to))", systemImage: "arrow.right")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                if let duration = call.duration, duration > 0 {
                    Label(FlynnFormatter.duration(seconds: duration), systemImage: "clock")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                }
                if let created = call.createdAt {
                    Label(created.formatted(date: .abbreviated, time: .shortened), systemImage: "calendar")
                        .flynnType(FlynnTypography.bodyMedium)
                        .foregroundColor(FlynnColor.textSecondary)
                }
            }
        }
    }

    private func transcriptCard(call: CallDTO) -> some View {
        FlynnCard(style: .quiet) {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                HStack {
                    Text("Transcript")
                        .flynnType(FlynnTypography.overline)
                        .foregroundColor(FlynnColor.textTertiary)
                    if let confidence = call.transcriptionConfidence {
                        Spacer()
                        Text("\(Int(confidence * 100))% confidence")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                }
                Text(call.transcriptionText ?? "")
                    .flynnType(FlynnTypography.bodyMedium)
                    .foregroundColor(FlynnColor.textPrimary)
            }
        }
    }

    private func recordingCard(call: CallDTO) -> some View {
        FlynnCard(style: .quiet) {
            VStack(alignment: .leading, spacing: FlynnSpacing.sm) {
                Text("Recording")
                    .flynnType(FlynnTypography.overline)
                    .foregroundColor(FlynnColor.textTertiary)
                if let urlString = call.recordingUrl, let url = URL(string: urlString) {
                    // Was a FlynnButton with an empty action wrapped in a Link
                    // with hit-testing disabled — it looked like an in-app
                    // player but did nothing on its own control. Now a real
                    // button with press feedback that opens the recording.
                    FlynnButton(
                        title: "Play recording",
                        action: { openURL(url) },
                        variant: .secondary,
                        icon: Image(systemName: "play.circle.fill")
                    )
                }
            }
        }
    }

    private var linkedEventCard: some View {
        FlynnCard(style: .quiet) {
            HStack {
                VStack(alignment: .leading, spacing: FlynnSpacing.xxs) {
                    Text("Linked event")
                        .flynnType(FlynnTypography.overline)
                        .foregroundColor(FlynnColor.textTertiary)
                    Text("Tap to view the event this call generated")
                        .flynnType(FlynnTypography.bodyMedium)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundColor(FlynnColor.textTertiary)
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            call = try await repository.fetch(id: callId)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
