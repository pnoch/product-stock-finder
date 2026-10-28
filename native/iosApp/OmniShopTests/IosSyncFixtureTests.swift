import CryptoKit
import Foundation
import XCTest

final class IosSyncFixtureTests: XCTestCase {
    private struct Fixture: Decodable {
        struct Sas: Decodable { let secret, hostFingerprint, clientFingerprint, expected: String }
        struct Pairing: Decodable {
            let version: Int
            let deviceId, fingerprint, host, secret: String
            let port: Int
            let expiresAt: Int64
        }
        let certificateDER, deviceId, fingerprint: String
        let sas: Sas
        let pairingPayload: Pairing
        let wireBatch: SyncBatch
    }

    private func fixture() throws -> Fixture {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "protocol", withExtension: "json"))
        return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
    }

    func testCertificateIdentityMatchesJvmFixture() throws {
        let fixture = try fixture()
        let der = try XCTUnwrap(Data(base64Encoded: fixture.certificateDER))
        let values = try XCTUnwrap(IosIdentity.identityValues(certificateDER: der))
        XCTAssertEqual(fixture.deviceId, values.deviceId)
        XCTAssertEqual(fixture.fingerprint, values.fingerprint)
    }

    func testSasMatchesJvmFixture() throws {
        let fixture = try fixture()
        XCTAssertEqual(
            fixture.sas.expected,
            sas(secret: fixture.sas.secret, hostFingerprint: fixture.sas.hostFingerprint,
                clientFingerprint: fixture.sas.clientFingerprint),
        )
    }

    func testPairingAndWirePayloadsDecode() throws {
        let fixture = try fixture()
        XCTAssertEqual(1, fixture.pairingPayload.version)
        XCTAssertEqual(8787, fixture.pairingPayload.port)
        XCTAssertEqual("watchlist", fixture.wireBatch.changes.first?.collection)
        XCTAssertEqual("device-a", fixture.wireBatch.cursor.originDevice)
    }
}
