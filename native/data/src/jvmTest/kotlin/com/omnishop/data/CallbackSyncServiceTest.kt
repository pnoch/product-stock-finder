package com.omnishop.data

import com.omnishop.data.security.JcaBackupCrypto
import kotlin.test.*

class CallbackSyncServiceTest {
    private class FakeTransport : CallbackSyncTransport {
        var syncCalls = 0
        var revoked: String? = null
        override fun thisDevice() = SyncDeviceInfo("device-a", "iOS", "fp-a")
        override fun peers() = emptyList<SyncPeerInfo>()
        override fun discoveredPeers() = emptyList<SyncDiscoveredPeer>()
        override fun createPairing(completion: (SyncPairingCode?, String?) -> Unit) =
            completion(SyncPairingCode("code", 100, "secret"), null)
        override fun pair(code: String, completion: (SyncResult) -> Unit) =
            completion(SyncResult.Success(0, 0, "123 456"))
        override fun pairDiscovered(peerId: String, secret: String, completion: (SyncResult) -> Unit) =
            completion(SyncResult.Success(0, 0, "123 456"))
        override fun sync(peerId: String, local: SyncBatch, completion: (SyncBatch?, String?) -> Unit) {
            syncCalls++
            completion(SyncBatch(emptyList(), SyncCursor.START), null)
        }
        override fun revoke(peerId: String) { revoked = peerId }
        override fun close() = Unit
        override fun attachSyncHandler(handler: (SyncBatch) -> SyncBatch) = Unit
    }

    @Test fun delegatesPairingAndAppliesSync(): Unit = kotlinx.coroutines.runBlocking {
        ShoppingStore.inMemory("local") { 100 }.use { store ->
            val transport = FakeTransport()
            val service = CallbackSyncService(transport, store)
            assertEquals("device-a", service.thisDevice().deviceId)
            assertEquals("secret", service.createPairing().secret)
            assertIs<SyncResult.Success>(service.pair("code"))
            assertIs<SyncResult.Success>(service.pairDiscovered("device-b", "secret"))
            assertIs<SyncResult.Success>(service.sync("device-b"))
            assertEquals(1, transport.syncCalls)
            store.setPreference("language", "THAI")
            assertEquals("device-a", store.syncMeta("settings", "language")!!.originDevice)
            service.revoke("device-b")
            assertEquals("device-b", transport.revoked)
            service.close()
        }
    }

    @Test fun receiptServiceParticipatesInBatches(): Unit = kotlinx.coroutines.runBlocking {
        ShoppingStore.inMemory("local") { 100 }.use { store ->
            val crypto = JcaBackupCrypto()
            val privateService = OrderPrivateService(store, InMemorySecretStore(), crypto)
            val receipts = ReceiptService(privateService, store, { "receipt-1" }) { 100 }
            val service = CallbackSyncService(FakeTransport(), store, receipts)
            assertIs<SyncResult.Success>(service.sync("device-b"))
        }
    }
}
