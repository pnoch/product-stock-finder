import Foundation
import Network
import Security
import CryptoKit

struct PairingPayload: Codable {
    let version: Int
    let deviceId: String
    let fingerprint: String
    let host: String
    let port: Int
    let secret: String
    let expiresAt: Int64
}

struct SyncCursor: Codable {
    let updatedAt: Int64
    let originDevice: String
    let id: String
}

struct SyncChange: Codable {
    let collection: String
    let id: String
    let updatedAt: Int64
    let originDevice: String
    let deletedAt: Int64?
    let payload: String?
}

struct SyncBatch: Codable {
    let changes: [SyncChange]
    let cursor: SyncCursor
}

struct WireMessage: Codable {
    let type: String
    var secret: String?
    var deviceId: String?
    var name: String?
    var fingerprint: String?
    var sas: String?
    var batch: SyncBatch?
    var message: String?
}

enum SyncClientError: Error {
    case invalidCode
    case connection(String)
    case protocolError(String)
}

final class IosSyncClient {
    private let identity: IosIdentity
    private let queue = DispatchQueue(label: "com.omnishop.sync.client")
    private var connection: NWConnection?

    init(identity: IosIdentity) { self.identity = identity }

    struct PairResult {
        let sas: String
        let payload: PairingPayload
        let hostFingerprint: String
    }

    func pair(code: String) throws -> PairResult {
        let payload = try decodeCode(code)
        guard payload.expiresAt > Int64(Date().timeIntervalSince1970 * 1000) else {
            throw SyncClientError.protocolError("Pairing code expired")
        }
        let connection = try connect(host: payload.host, port: payload.port, pinnedFingerprint: payload.fingerprint)
        defer { connection.cancel(); self.connection = nil }
        try send(connection, WireMessage(
            type: "pair", secret: payload.secret, deviceId: identity.deviceId,
            name: "iOS", fingerprint: identity.fingerprint
        ))
        let response = try receive(connection)
        guard response.type == "paired" else {
            throw SyncClientError.protocolError(response.message ?? "Pairing rejected")
        }
        guard let hostFingerprint = response.fingerprint else {
            throw SyncClientError.protocolError("Missing host fingerprint")
        }
        let expected = sas(secret: payload.secret, hostFingerprint: hostFingerprint, clientFingerprint: identity.fingerprint)
        guard response.sas == expected else {
            throw SyncClientError.protocolError("SAS mismatch")
        }
        return PairResult(sas: expected, payload: payload, hostFingerprint: hostFingerprint)
    }

    func sync(peerHost: String, port: Int, pinnedFingerprint: String, local: SyncBatch) throws -> SyncBatch {
        let connection = try connect(host: peerHost, port: port, pinnedFingerprint: pinnedFingerprint)
        defer { connection.cancel(); self.connection = nil }
        try send(connection, WireMessage(type: "sync", batch: local))
        let response = try receive(connection)
        guard response.type == "sync", let batch = response.batch else {
            throw SyncClientError.protocolError(response.message ?? "Sync rejected")
        }
        return batch
    }

    private func decodeCode(_ code: String) throws -> PairingPayload {
        guard let data = base64URLDecode(code) else { throw SyncClientError.invalidCode }
        do { return try JSONDecoder().decode(PairingPayload.self, from: data) }
        catch { throw SyncClientError.invalidCode }
    }

    private func connect(host: String, port: Int, pinnedFingerprint: String) throws -> NWConnection {
        guard let portValue = NWEndpoint.Port(rawValue: UInt16(port)) else {
            throw SyncClientError.connection("Invalid port")
        }
        let tls = NWProtocolTLS.Options()
        sec_protocol_options_set_min_tls_protocol_version(tls.securityProtocolOptions, .TLSv12)
        guard let secIdentity = sec_identity_create(try requireIdentity()) else {
            throw SyncClientError.connection("Identity unavailable")
        }
        sec_protocol_options_set_local_identity(tls.securityProtocolOptions, secIdentity)
        sec_protocol_options_set_verify_block(tls.securityProtocolOptions, { _, trust, complete in
            let secTrust = sec_trust_copy_ref(trust).takeRetainedValue()
            guard let chain = SecTrustCopyCertificateChain(secTrust) as? [SecCertificate],
                  let certificate = chain.first else {
                complete(false); return
            }
            let fingerprint = SHA256.hash(data: SecCertificateCopyData(certificate) as Data)
                .map { String(format: "%02x", $0) }.joined()
            complete(fingerprint == pinnedFingerprint)
        }, queue)
        let parameters = NWParameters(tls: tls, tcp: NWProtocolTCP.Options())
        let connection = NWConnection(host: NWEndpoint.Host(host), port: portValue, using: parameters)
        self.connection = connection
        let semaphore = DispatchSemaphore(value: 0)
        var failure: NWError?
        connection.stateUpdateHandler = { state in
            switch state {
            case .ready: semaphore.signal()
            case .failed(let error), .waiting(let error): failure = error; semaphore.signal()
            default: break
            }
        }
        connection.start(queue: queue)
        if semaphore.wait(timeout: .now() + 10) == .timedOut {
            connection.cancel()
            throw SyncClientError.connection("Connection timed out")
        }
        if let failure { connection.cancel(); throw SyncClientError.connection(failure.localizedDescription) }
        return connection
    }

    private func requireIdentity() throws -> SecIdentity {
        guard let identity = identity.identity else { throw SyncClientError.connection("Identity unavailable") }
        return identity
    }

    private func send(_ connection: NWConnection, _ message: WireMessage) throws {
        let json = try JSONEncoder().encode(message)
        var frame = Data()
        var length = UInt32(json.count).bigEndian
        frame.append(Data(bytes: &length, count: 4))
        frame.append(json)
        let semaphore = DispatchSemaphore(value: 0)
        var failure: NWError?
        connection.send(content: frame, completion: .contentProcessed { error in
            failure = error; semaphore.signal()
        })
        if semaphore.wait(timeout: .now() + 10) == .timedOut { throw SyncClientError.connection("Send timed out") }
        if let failure { throw SyncClientError.connection(failure.localizedDescription) }
    }

    private func receive(_ connection: NWConnection) throws -> WireMessage {
        guard let lengthData = readExactly(connection, 4) else { throw SyncClientError.connection("No response") }
        let length = lengthData.withUnsafeBytes { $0.load(as: UInt32.self).bigEndian }
        guard length > 0, length <= 32 * 1024 * 1024 else { throw SyncClientError.protocolError("Invalid frame") }
        guard let json = readExactly(connection, Int(length)) else { throw SyncClientError.connection("Incomplete frame") }
        return try JSONDecoder().decode(WireMessage.self, from: json)
    }

    private func readExactly(_ connection: NWConnection, _ count: Int) -> Data? {
        var result = Data()
        while result.count < count {
            let remaining = count - result.count
            let semaphore = DispatchSemaphore(value: 0)
            var chunk: Data?
            var failure: NWError?
            connection.receive(minimumIncompleteLength: remaining, maximumLength: remaining) { data, _, complete, error in
                chunk = data; failure = error; semaphore.signal()
            }
            if semaphore.wait(timeout: .now() + 10) == .timedOut { return nil }
            if failure != nil { return nil }
            guard let data = chunk, !data.isEmpty else { return nil }
            result.append(data)
        }
        return result
    }

    private func base64URLDecode(_ value: String) -> Data? {
        var text = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while text.count % 4 != 0 { text.append("=") }
        return Data(base64Encoded: text)
    }
}
