import SwiftUI

/// Reproduces /src/components/AnimatedSplashScreen.tsx:
/// 1. Stroke-draw the F body + orange dot over 2s with bezier(0.25, 0.1, 0.25, 1)
/// 2. Fade the fill in over the last ~400ms of the draw
/// 3. Once `isAppReady` is true AND the draw finished, scale to ~50x and fade out
struct AnimatedSplashView: View {
    let isAppReady: Bool
    let onFinish: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var drawProgress: CGFloat = 0
    @State private var fillOpacity: Double = 0
    @State private var exitScale: CGFloat = 1
    @State private var exitOpacity: Double = 1
    @State private var drawFinished = false
    @State private var exiting = false
    // Mirrors the `isAppReady` prop as @State so closures can read the live value.
    @State private var appReady = false

    private let drawDuration: Double = 2.0
    private let strokeWidth: CGFloat = 5

    var body: some View {
        ZStack {
            FlynnColor.splashBackground
                .ignoresSafeArea()

            ZStack {
                // Body: stroke draws first, then fill fades in
                FLogoBody()
                    .trim(from: 0, to: drawProgress)
                    .stroke(
                        FlynnColor.splashLogoBody,
                        style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round, lineJoin: .round)
                    )
                FLogoBody()
                    .fill(FlynnColor.splashLogoBody)
                    .opacity(fillOpacity)

                // Dot
                FLogoDot()
                    .trim(from: 0, to: drawProgress)
                    .stroke(
                        FlynnColor.splashLogoDot,
                        style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round, lineJoin: .round)
                    )
                FLogoDot()
                    .fill(FlynnColor.splashLogoDot)
                    .opacity(fillOpacity)
            }
            .frame(width: 300, height: 300)
            .scaleEffect(exitScale)
            .opacity(exitOpacity)
        }
        .onAppear {
            appReady = isAppReady
            startDraw()
        }
        .onChange(of: isAppReady) { _, ready in
            appReady = ready
            if ready && drawFinished { triggerExit() }
        }
    }

    private func startDraw() {
        if reduceMotion {
            drawProgress = 1
            fillOpacity = 1
            drawFinished = true
            if appReady { triggerExit() }
            return
        }

        withAnimation(.timingCurve(0.25, 0.1, 0.25, 1, duration: drawDuration)) {
            drawProgress = 1
        }
        // Fill starts ~80% of the way through the draw, matching the JS (progress > 0.8)
        withAnimation(.easeIn(duration: 0.4).delay(drawDuration * 0.8)) {
            fillOpacity = 1
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + drawDuration) {
            drawFinished = true
            if appReady { triggerExit() }
        }
    }

    private func triggerExit() {
        guard !exiting else { return }
        exiting = true

        if reduceMotion {
            withAnimation(.easeIn(duration: 0.2)) { exitOpacity = 0 }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { onFinish() }
            return
        }

        withAnimation(.easeIn(duration: 0.8)) { exitScale = 50 }
        withAnimation(.easeIn(duration: 0.6)) { exitOpacity = 0 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { onFinish() }
    }
}

#Preview("Splash") {
    AnimatedSplashView(isAppReady: true, onFinish: {})
}
