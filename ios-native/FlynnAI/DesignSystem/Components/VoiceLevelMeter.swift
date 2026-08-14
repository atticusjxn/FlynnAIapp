import SwiftUI

/// A handful of bars that react to real mic amplitude — shared by every
/// "hold to talk" surface so a listening Flynn always reads as the same
/// instrument, not a per-screen reinterpretation.
///
/// Sampled on a fixed 15Hz tick via `TimelineView` rather than redrawing on
/// every `level` change: the mic tap fires ~40 times a second and animating
/// off every callback reads as jitter, not responsiveness. Decoupling the
/// visual cadence from the audio cadence is also what keeps the idle
/// "breathing" motion below going even when `level` sits dead at zero and
/// never fires a change at all.
///
/// Bars don't share one height. Each carries its own amplitude and phase —
/// without that, five bars just move as one block, which is the giveaway
/// that a meter is decorative rather than driven by the actual signal.
struct VoiceLevelMeter: View {
    var level: Float
    var barCount: Int = 5
    var tint: Color = FlynnColor.primary

    /// Under Reduce Motion the idle "breathing" wave is dropped and the bars
    /// rest flat, but real amplitude still drives them — the meter is the only
    /// signal that Flynn is hearing you, so muting it entirely would remove
    /// information rather than just decoration.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private static let minHeight: CGFloat = 4
    private static let maxHeight: CGFloat = 20
    private static let amplitudes: [CGFloat] = [0.5, 0.78, 1.0, 0.78, 0.5]
    private static let idlePhases: [Double] = [0, 0.55, 1.1, 1.65, 2.2]

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1.0 / 15)) { context in
            let speaking = level > 0.04
            let idleAnimated = !reduceMotion
            let now = context.date.timeIntervalSinceReferenceDate
            HStack(alignment: .center, spacing: 3) {
                ForEach(0..<barCount, id: \.self) { i in
                    Capsule()
                        .fill(tint)
                        .frame(width: 3, height: height(index: i, speaking: speaking,
                                                       now: idleAnimated ? now : 0))
                }
            }
            .frame(height: Self.maxHeight, alignment: .center)
            .animation(.easeOut(duration: speaking ? 0.09 : 0.4), value: level)
        }
        // Decorative — the parent already carries "Listening" plus the live
        // transcript as the accessible value.
        .accessibilityHidden(true)
    }

    private func height(index: Int, speaking: Bool, now: TimeInterval) -> CGFloat {
        let amp = Self.amplitudes[index % Self.amplitudes.count]
        if speaking {
            let h = Self.minHeight + (Self.maxHeight - Self.minHeight) * CGFloat(level) * amp
            return min(max(h, Self.minHeight), Self.maxHeight)
        }
        let phase = Self.idlePhases[index % Self.idlePhases.count]
        let wave = (sin(now * 1.6 + phase) + 1) / 2
        return Self.minHeight + (Self.maxHeight - Self.minHeight) * 0.22 * amp * CGFloat(wave)
    }
}
