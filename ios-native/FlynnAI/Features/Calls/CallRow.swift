import SwiftUI

struct CallRow: View {
    let call: CallDTO

    var body: some View {
        FlynnCard(shadow: .sm) {
            VStack(alignment: .leading, spacing: FlynnSpacing.xs) {
                HStack(alignment: .firstTextBaseline) {
                    Text(FlynnFormatter.phone(call.fromNumber) )
                        .flynnType(FlynnTypography.h4)
                        .foregroundColor(FlynnColor.textPrimary)
                    Spacer()
                    CallStatusBadge(status: call.status)
                }

                HStack(spacing: FlynnSpacing.xs) {
                    if let created = call.createdAt {
                        Text(FlynnFormatter.relativeDate(created))
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                    if let duration = call.duration, duration > 0 {
                        Text("·")
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                        Text(FlynnFormatter.duration(seconds: duration))
                            .flynnType(FlynnTypography.caption)
                            .foregroundColor(FlynnColor.textTertiary)
                    }
                    if call.hasTranscript {
                        Spacer()
                        Label("Transcript", systemImage: "text.bubble")
                            .labelStyle(.iconOnly)
                            .foregroundColor(FlynnColor.primary)
                    } else if call.hasRecording {
                        Spacer()
                        Image(systemName: "waveform")
                            .foregroundColor(FlynnColor.primary)
                    }
                }
            }
        }
    }
}
