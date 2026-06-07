import XCTest
@testable import FlynnDesktop

final class FlynnDesktopTests: XCTestCase {

    // MARK: - ConversationBuffer

    func testConversationBufferAccumulatesMessages() {
        let buffer = ConversationBuffer(windowSeconds: 600)
        buffer.append(message: "Hey are you free Friday?", to: "thread1")
        buffer.append(message: "Also what does it cost?", to: "thread1")
        let msgs = buffer.messages(for: "thread1")
        XCTAssertEqual(msgs.count, 2)
        XCTAssertEqual(msgs[0], "Hey are you free Friday?")
    }

    func testConversationBufferExpiresOldMessages() {
        let buffer = ConversationBuffer(windowSeconds: 0) // instant expiry
        buffer.append(message: "old message", to: "expired")
        // After 0s window, next read triggers prune
        let msgs = buffer.messages(for: "expired")
        XCTAssertTrue(msgs.isEmpty)
    }

    func testConversationBufferReset() {
        let buffer = ConversationBuffer(windowSeconds: 600)
        buffer.append(message: "test", to: "t1")
        buffer.reset(threadKey: "t1")
        XCTAssertTrue(buffer.messages(for: "t1").isEmpty)
    }

    // MARK: - DraftCache

    func testDraftCacheStoreAndGet() {
        let cache = DraftCache()
        cache.store(drafts: ["Draft A", "Draft B"], threadID: "abc123")
        let result = cache.get(threadID: "abc123")
        XCTAssertEqual(result, ["Draft A", "Draft B"])
    }

    func testDraftCacheInvalidate() {
        let cache = DraftCache()
        cache.store(drafts: ["x"], threadID: "toDelete")
        cache.invalidate(threadID: "toDelete")
        XCTAssertNil(cache.get(threadID: "toDelete"))
    }

    // MARK: - SlotFinder intent detection

    func testTimeIntentDetectedForBookingLanguage() {
        XCTAssertTrue(SlotFinder.conversationHasTimeIntent(["When are you free next week?"]))
        XCTAssertTrue(SlotFinder.conversationHasTimeIntent(["Can you book me in for Thursday?"]))
        XCTAssertTrue(SlotFinder.conversationHasTimeIntent(["Do you have any available slots?"]))
    }

    func testTimeIntentNotDetectedForGeneralMessages() {
        XCTAssertFalse(SlotFinder.conversationHasTimeIntent(["How much for a standard clean?"]))
        XCTAssertFalse(SlotFinder.conversationHasTimeIntent(["What area do you cover?"]))
    }
}
