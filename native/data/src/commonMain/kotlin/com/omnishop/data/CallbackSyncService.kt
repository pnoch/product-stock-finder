package com.omnishop.data

import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

interface CallbackSyncTransport {
    fun thisDevice(): SyncDeviceInfo
    fun peers(): List<SyncPeerInfo>
    fun discoveredPeers(): List<SyncDiscoveredPeer>
    fun createPairing(completion: (SyncPairingCode?, String?) -> Unit)
    fun pair(code: String, completion: (SyncResult) -> Unit)
    fun pairDiscovered(peerId: String, secret: String, completion: (SyncResult) -> Unit)
    fun sync(peerId: String, local: SyncBatch, completion: (SyncBatch?, String?) -> Unit)
    fun revoke(peerId: String)
    fun close()
    fun attachSyncHandler(handler: (SyncBatch) -> SyncBatch)
}

class CallbackSyncService(
    private val transport: CallbackSyncTransport,
    store: ShoppingStore,
    receipts: ReceiptService? = null,
) : SyncService {
    private val engine = SyncEngine(store, receipts)

    init {
        store.setOriginDevice(transport.thisDevice().deviceId)
        transport.attachSyncHandler { remote ->
            engine.apply(remote.changes)
            allLocalChanges()
        }
    }

    override fun thisDevice(): SyncDeviceInfo = transport.thisDevice()

    override fun peers(): List<SyncPeerInfo> = transport.peers()

    override fun discoveredPeers(): List<SyncDiscoveredPeer> = transport.discoveredPeers()

    override suspend fun createPairing(): SyncPairingCode = suspendCoroutine { continuation ->
        transport.createPairing { code, error ->
            if (code != null) continuation.resume(code)
            else continuation.resumeWith(Result.failure(IllegalStateException(error ?: "Pairing unavailable")))
        }
    }

    override suspend fun pair(code: String): SyncResult = suspendCoroutine { continuation ->
        transport.pair(code) { result -> continuation.resume(result) }
    }

    override suspend fun pairDiscovered(peerId: String, secret: String): SyncResult =
        suspendCoroutine { continuation ->
            transport.pairDiscovered(peerId, secret) { result -> continuation.resume(result) }
        }

    override suspend fun sync(peerId: String): SyncResult {
        val local = allLocalChanges()
        return suspendCoroutine { continuation ->
            transport.sync(peerId, local) { remote, error ->
                if (remote == null) {
                    continuation.resume(SyncResult.Failure(error ?: "Sync failed"))
                } else {
                    val applied = engine.apply(remote.changes)
                    continuation.resume(SyncResult.Success(applied, local.changes.size))
                }
            }
        }
    }

    override fun revoke(peerId: String) = transport.revoke(peerId)

    override fun close() = transport.close()

    private fun allLocalChanges(): SyncBatch {
        val changes = mutableListOf<SyncChange>()
        var cursor = SyncCursor.START
        while (true) {
            val batch = engine.localChanges(cursor, 500)
            changes += batch.changes
            if (batch.changes.isEmpty() || batch.cursor == cursor) break
            cursor = batch.cursor
        }
        return SyncBatch(changes, cursor)
    }
}
