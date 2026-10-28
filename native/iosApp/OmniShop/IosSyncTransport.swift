import CryptoKit
import Foundation
import Network
import OmniShopShared
import Security

final class IosSyncTransport: NSObject, DataCallbackSyncTransport {
    private struct StoredPeer: Codable {
        var deviceId: String
        var displayName: String
        var endpoint: String
        var fingerprint: String
        var sas: String?
        var lastSyncAt: Int64
    }

    private let identity: IosIdentity
    private let client: IosSyncClient
    private var host: IosSyncHost?
    private var syncHandler: ((DataSyncBatch) -> DataSyncBatch)?
    private let defaults = UserDefaults.standard
    private let peersKey = "sync.peers.v1"
    private let queue = DispatchQueue(label: "com.omnishop.sync.transport")

    init(identity: IosIdentity? = nil) throws {
        let resolved = try identity ?? IosIdentity.loadOrCreate()
        self.identity = resolved
        self.client = IosSyncClient(identity: resolved)
        super.init()
    }

    func close() {
        host?.close()
        host = nil
    }

    func attachSyncHandler(handler: @escaping (DataSyncBatch) -> DataSyncBatch) {
        syncHandler = handler
    }

    func createPairing(completion: @escaping (DataSyncPairingCode?, String?) -> Void) {
        do {
            host?.close()
            let host = try IosSyncHost(identity: identity)
            host.onPeerPaired = { [weak self] deviceId, name, endpoint, fingerprint, sas in
                self?.savePeer(StoredPeer(
                    deviceId: deviceId, displayName: name, endpoint: endpoint,
                    fingerprint: fingerprint, sas: sas,
                    lastSyncAt: Int64(Date().timeIntervalSince1970 * 1000),
                ))
            }
            host.syncHandler = { [weak self] remote in
                guard let self, let handler = self.syncHandler else { return nil }
                guard let json = try? JSONEncoder().encode(remote),
                      let value = String(data: json, encoding: .utf8) else { return nil }
                let remoteBatch = IosSyncCodec.shared.decodeBatch(value: value)
                let localBatch = handler(remoteBatch)
                let localJson = IosSyncCodec.shared.encodeBatch(batch: localBatch)
                return try? JSONDecoder().decode(SyncBatch.self, from: Data(localJson.utf8))
            }
            try host.start()
            let payload = host.createCode()
            self.host = host
            let code = try JSONEncoder().encode(payload).base64EncodedString()
                .replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")
            completion(DataSyncPairingCode(
                code: code,
                expiresAtEpochMillis: payload.expiresAt,
                secret: payload.secret,
            ), nil)
        } catch {
            completion(nil, error.localizedDescription)
        }
    }

    func discoveredPeers() -> [DataSyncDiscoveredPeer] { [] }

    func pair(code: String, completion: @escaping (any DataSyncResult) -> Void) {
        queue.async {
            do {
                let result = try self.client.pair(code: code)
                let payload = result.payload
                self.savePeer(StoredPeer(
                    deviceId: payload.deviceId,
                    displayName: "Desktop",
                    endpoint: "\(payload.host):\(payload.port)",
                    fingerprint: result.hostFingerprint,
                    sas: result.sas,
                    lastSyncAt: Int64(Date().timeIntervalSince1970 * 1000),
                ))
                completion(IosSyncCodec.shared.success(applied: 0, sent: 0, sas: result.sas))
            } catch {
                completion(IosSyncCodec.shared.failure(message: error.localizedDescription))
            }
        }
    }

    func pairDiscovered(peerId: String, secret: String, completion: @escaping (any DataSyncResult) -> Void) {
        completion(IosSyncCodec.shared.failure(message: "Nearby pairing is not available on iOS yet"))
    }

    func peers() -> [DataSyncPeerInfo] {
        loadPeers().map {
            DataSyncPeerInfo(
                deviceId: $0.deviceId,
                displayName: $0.displayName,
                endpoint: $0.endpoint,
                lastSyncAtEpochMillis: $0.lastSyncAt,
                sas: $0.sas,
            )
        }
    }

    func revoke(peerId: String) {
        savePeers(loadPeers().filter { $0.deviceId != peerId })
    }

    func sync(peerId: String, local: DataSyncBatch, completion: @escaping (DataSyncBatch?, String?) -> Void) {
        queue.async {
            guard let peer = self.loadPeers().first(where: { $0.deviceId == peerId }) else {
                completion(nil, "Paired device not found")
                return
            }
            let host = peer.endpoint.split(separator: ":").dropLast().joined(separator: ":")
            guard let port = Int(peer.endpoint.split(separator: ":").last ?? "") else {
                completion(nil, "Invalid device endpoint")
                return
            }
            do {
                let localJson = IosSyncCodec.shared.encodeBatch(batch: local)
                let localBatch = try JSONDecoder().decode(SyncBatch.self, from: Data(localJson.utf8))
                let remote = try self.client.sync(
                    peerHost: host,
                    port: port,
                    pinnedFingerprint: peer.fingerprint,
                    local: localBatch,
                )
                let remoteJson = String(data: try JSONEncoder().encode(remote), encoding: .utf8) ?? ""
                let remoteBatch = IosSyncCodec.shared.decodeBatch(value: remoteJson)
                self.savePeer(StoredPeer(
                    deviceId: peer.deviceId,
                    displayName: peer.displayName,
                    endpoint: peer.endpoint,
                    fingerprint: peer.fingerprint,
                    sas: peer.sas,
                    lastSyncAt: Int64(Date().timeIntervalSince1970 * 1000),
                ))
                completion(remoteBatch, nil)
            } catch {
                completion(nil, error.localizedDescription)
            }
        }
    }

    func thisDevice() -> DataSyncDeviceInfo {
        DataSyncDeviceInfo(deviceId: identity.deviceId, displayName: "iOS", fingerprint: identity.fingerprint)
    }

    private func loadPeers() -> [StoredPeer] {
        guard let data = defaults.data(forKey: peersKey) else { return [] }
        return (try? JSONDecoder().decode([StoredPeer].self, from: data)) ?? []
    }

    private func savePeer(_ peer: StoredPeer) {
        savePeers(loadPeers().filter { $0.deviceId != peer.deviceId } + [peer])
    }

    private func savePeers(_ peers: [StoredPeer]) {
        defaults.set(try? JSONEncoder().encode(peers), forKey: peersKey)
    }
}
