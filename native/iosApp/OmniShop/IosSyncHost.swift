import Foundation
import Network
import Security
import CryptoKit

final class IosSyncHost {
    private let identity: IosIdentity
    private let queue = DispatchQueue(label: "com.omnishop.sync.host")
    private let connectionQueue = DispatchQueue(label: "com.omnishop.sync.host.connections", attributes: .concurrent)
    private var listener: NWListener?
    private var secret: String?
    private var expiresAt: Int64 = 0
    private(set) var port: UInt16 = 8787
    var syncHandler: ((SyncBatch) -> SyncBatch?)?
    var onPeerPaired: ((String, String, String, String, String) -> Void)?
    private var pairedFingerprints = Set<String>()

    private let advertisedHost: String?

    init(identity: IosIdentity, advertisedHost: String? = nil) {
        self.identity = identity
        self.advertisedHost = advertisedHost
    }

    func start() throws {
        let tls = NWProtocolTLS.Options()
        guard let secIdentity = sec_identity_create(try requireIdentity()) else {
            throw SyncClientError.connection("Identity unavailable")
        }
        sec_protocol_options_set_local_identity(tls.securityProtocolOptions, secIdentity)
        sec_protocol_options_set_peer_authentication_required(tls.securityProtocolOptions, true)
        sec_protocol_options_set_verify_block(tls.securityProtocolOptions, { _, _, complete in
            complete(true)
        }, queue)
        let params = NWParameters(tls: tls, tcp: NWProtocolTCP.Options())
        let listener = try NWListener(using: params, on: NWEndpoint.Port(rawValue: 8787)!)
        self.listener = listener
        let semaphore = DispatchSemaphore(value: 0)
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready: semaphore.signal()
            case .failed(let error):
                FileHandle.standardError.write(Data("host state failure \(error)\n".utf8))
                semaphore.signal()
            case .cancelled:
                FileHandle.standardError.write(Data("host state cancelled\n".utf8))
                semaphore.signal()
            default: break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            self?.connectionQueue.async { self?.handle(connection) }
        }
        listener.start(queue: queue)
        _ = semaphore.wait(timeout: .now() + 10)
        self.port = listener.port?.rawValue ?? 8787
    }

    func createCode() -> PairingPayload {
        let secretBytes = (0..<16).map { _ in UInt8.random(in: 0...255) }
        let secret = Data(secretBytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        self.secret = secret
        self.expiresAt = Int64(Date().timeIntervalSince1970 * 1000) + 300_000
        let txt = NWTXTRecord([
            "v": "1", "id": identity.deviceId, "fp": identity.fingerprint,
            "name": "iOS", "expires": String(expiresAt),
            "host": localIPv4(), "port": String(port),
        ])
        listener?.service = NWListener.Service(
            name: "OmniShop-\(identity.deviceId.prefix(8))",
            type: "_omnishop._tcp", domain: nil, txtRecord: txt,
        )
        return PairingPayload(
            version: 1, deviceId: identity.deviceId, fingerprint: identity.fingerprint,
            host: advertisedHost ?? localIPv4(), port: Int(port), secret: secret, expiresAt: expiresAt,
        )
    }

    func close() { listener?.cancel() }

    private func peerFingerprint(_ connection: NWConnection) -> String? {
        guard let metadata = connection.metadata(definition: NWProtocolTLS.definition) as? NWProtocolTLS.Metadata,
              let chain = sec_protocol_metadata_copy_peer_certificate_chain(metadata.securityProtocolMetadata)?
                .takeRetainedValue() as? [SecCertificate],
              let certificate = chain.first else { return nil }
        return SHA256.hash(data: SecCertificateCopyData(certificate) as Data)
            .map { String(format: "%02x", $0) }.joined()
    }

    private func localIPv4() -> String {
        var address: String? = nil
        var interfaces: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&interfaces) == 0, let first = interfaces else { return "127.0.0.1" }
        defer { freeifaddrs(interfaces) }
        var pointer: UnsafeMutablePointer<ifaddrs>? = first
        while let interface = pointer {
            let family = interface.pointee.ifa_addr.pointee.sa_family
            if family == UInt8(AF_INET), (interface.pointee.ifa_flags & UInt32(IFF_LOOPBACK)) == 0 {
                var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                let result = getnameinfo(
                    interface.pointee.ifa_addr,
                    socklen_t(interface.pointee.ifa_addr.pointee.sa_len),
                    &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST,
                )
                if result == 0 {
                    address = String(cString: host)
                    if interface.pointee.ifa_name.map({ String(cString: $0) }) == "en0" { break }
                }
            }
            pointer = interface.pointee.ifa_next
        }
        return address ?? "127.0.0.1"
    }

    private func requireIdentity() throws -> SecIdentity {
        guard let identity = identity.identity else { throw SyncClientError.connection("Identity unavailable") }
        return identity
    }

    private func handle(_ connection: NWConnection) {
        connection.start(queue: connectionQueue)
        let semaphore = DispatchSemaphore(value: 0)
        connection.stateUpdateHandler = { state in
            FileHandle.standardError.write(Data("host state \(state)\n".utf8))
            switch state {
            case .ready: semaphore.signal()
            case .failed(let error):
                FileHandle.standardError.write(Data("host state failure \(error)\n".utf8))
                semaphore.signal()
            case .cancelled:
                FileHandle.standardError.write(Data("host state cancelled\n".utf8))
                semaphore.signal()
            default: break
            }
        }
        if semaphore.wait(timeout: .now() + 10) == .timedOut { connection.cancel(); return }
        do {
            let message = try receive(connection)
            FileHandle.standardError.write(Data("host message \(message.type)\n".utf8))
            switch message.type {
            case "pair":
                guard let secret, Int64(Date().timeIntervalSince1970 * 1000) <= expiresAt,
                      message.secret == secret else {
                    try send(connection, WireMessage(type: "error", message: "Pairing code rejected"))
                    connection.cancel(); return
                }
                guard let clientFingerprint = peerFingerprint(connection),
                      message.fingerprint == clientFingerprint else {
                    try send(connection, WireMessage(type: "error", message: "Client fingerprint mismatch"))
                    connection.cancel(); return
                }
                let sas = sas(secret: secret, hostFingerprint: identity.fingerprint, clientFingerprint: clientFingerprint)
                let deviceId = message.deviceId ?? ""
                pairedFingerprints.insert(clientFingerprint)
                onPeerPaired?(deviceId, message.name ?? "Device", "\(localIPv4()):\(port)", clientFingerprint, sas)
                try send(connection, WireMessage(
                    type: "paired", deviceId: identity.deviceId, name: "iOS",
                    fingerprint: identity.fingerprint, sas: sas,
                ))
                self.secret = nil
            case "sync":
                guard let clientFingerprint = peerFingerprint(connection),
                      pairedFingerprints.contains(clientFingerprint) else {
                    try send(connection, WireMessage(type: "error", message: "Unknown peer"))
                    connection.cancel(); return
                }
                let remote = message.batch ?? SyncBatch(
                    changes: [], cursor: SyncCursor(updatedAt: 0, originDevice: "", id: ""),
                )
                let local = syncHandler?(remote) ?? SyncBatch(
                    changes: [], cursor: SyncCursor(updatedAt: 0, originDevice: "", id: ""),
                )
                try send(connection, WireMessage(type: "sync", batch: local))
            default:
                try send(connection, WireMessage(type: "error", message: "Unsupported request"))
            }
        } catch {
            FileHandle.standardError.write(Data("host error \(error)\n".utf8))
            try? send(connection, WireMessage(type: "error", message: error.localizedDescription))
        }
        connection.cancel()
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
        _ = semaphore.wait(timeout: .now() + 10)
        if let failure { throw SyncClientError.connection(failure.localizedDescription) }
    }

    private func receive(_ connection: NWConnection) throws -> WireMessage {
        guard let lengthData = readExactly(connection, 4) else { throw SyncClientError.connection("No request") }
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
            connection.receive(minimumIncompleteLength: remaining, maximumLength: remaining) { data, _, _, error in
                chunk = data; failure = error; semaphore.signal()
            }
            if semaphore.wait(timeout: .now() + 10) == .timedOut { return nil }
            if failure != nil { return nil }
            guard let data = chunk, !data.isEmpty else { return nil }
            result.append(data)
        }
        return result
    }
}
