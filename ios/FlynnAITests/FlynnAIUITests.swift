import XCTest

@MainActor
final class FlynnAIUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false

        app = XCUIApplication()
        setupSnapshot(app)
        app.launch()

        waitForAppToStabilize()
    }

    override func tearDown() {
        app = nil
        super.tearDown()
    }

    func testCaptureScreenshots() {
        captureScreenshot(named: "01-home")
        captureScreenshot(named: "02-intake", after: 2)
        captureScreenshot(named: "03-summary", after: 2)
    }

    private func waitForAppToStabilize(timeout: TimeInterval = 15) {
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: timeout), "App did not reach foreground state in time")
        RunLoop.current.run(until: Date().addingTimeInterval(3))
    }

    private func captureScreenshot(named name: String, after delay: TimeInterval = 1) {
        RunLoop.current.run(until: Date().addingTimeInterval(delay))
        snapshot(name)
    }
}
