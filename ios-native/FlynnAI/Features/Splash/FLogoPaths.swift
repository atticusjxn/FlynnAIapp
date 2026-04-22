import SwiftUI

// SVG paths from /src/components/AnimatedSplashScreen.tsx.
// Source viewBox is 500x500; both shapes scale proportionally into the target rect.
// The original SVG uses cubic Bézier segments whose control points are collinear,
// so each "C" flattens to a straight line segment — we reproduce as line segments.

struct FLogoBody: Shape {
    // translate(82, 75) in source viewBox
    private static let originX: CGFloat = 82
    private static let originY: CGFloat = 75

    // Polygon vertices in local (pre-translate) coords
    private static let vertices: [CGPoint] = [
        CGPoint(x: 0, y: 0),
        CGPoint(x: 354, y: 0),
        CGPoint(x: 354, y: 98),
        CGPoint(x: 111, y: 98),
        CGPoint(x: 111, y: 124),
        CGPoint(x: 290, y: 124),
        CGPoint(x: 290, y: 221),
        CGPoint(x: 111, y: 221),
        CGPoint(x: 111, y: 242),
        CGPoint(x: 0, y: 242)
    ]

    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 500
        let sy = rect.height / 500
        var path = Path()
        guard let first = Self.vertices.first else { return path }
        let tx: (CGPoint) -> CGPoint = { p in
            CGPoint(
                x: (p.x + Self.originX) * sx,
                y: (p.y + Self.originY) * sy
            )
        }
        path.move(to: tx(first))
        for v in Self.vertices.dropFirst() {
            path.addLine(to: tx(v))
        }
        path.closeSubpath()
        return path
    }
}

struct FLogoDot: Shape {
    // translate(83, 339) in source viewBox
    private static let originX: CGFloat = 83
    private static let originY: CGFloat = 339

    private static let vertices: [CGPoint] = [
        CGPoint(x: 0, y: 0),
        CGPoint(x: 110, y: 0),
        CGPoint(x: 110, y: 86),
        CGPoint(x: 0, y: 86)
    ]

    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 500
        let sy = rect.height / 500
        var path = Path()
        guard let first = Self.vertices.first else { return path }
        let tx: (CGPoint) -> CGPoint = { p in
            CGPoint(
                x: (p.x + Self.originX) * sx,
                y: (p.y + Self.originY) * sy
            )
        }
        path.move(to: tx(first))
        for v in Self.vertices.dropFirst() {
            path.addLine(to: tx(v))
        }
        path.closeSubpath()
        return path
    }
}
