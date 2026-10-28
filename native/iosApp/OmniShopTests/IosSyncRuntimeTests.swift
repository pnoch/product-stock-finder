import XCTest
@testable import OmniShop

final class IosSyncRuntimeTests: XCTestCase {
    func testHostAndClientPairAndSync() throws {
        let identity = try IosIdentity.loadOrCreate()
        let host = IosSyncHost(identity: identity)
        let paired = expectation(description: "host saw paired client")
        host.onPeerPaired = { _, _, _, _, _ in paired.fulfill() }
        host.syncHandler = { _ in
            SyncBatch(changes: [], cursor: SyncCursor(updatedAt: 0, originDevice: "", id: ""))
        }
        try host.start()
        defer { host.close() }

        let payload = host.createCode()
        let code = try JSONEncoder().encode(payload).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        let client = IosSyncClient(identity: identity)
        let result = try client.pair(code: code)
        XCTAssertEqual(result.payload.deviceId, payload.deviceId)
        wait(for: [paired], timeout: 5)
        let batch = try client.sync(
            peerHost: payload.host,
            port: payload.port,
            pinnedFingerprint: payload.fingerprint,
            local: SyncBatch(changes: [], cursor: SyncCursor(updatedAt: 0, originDevice: "", id: "")),
        )
        XCTAssertTrue(batch.changes.isEmpty)
    }
}
