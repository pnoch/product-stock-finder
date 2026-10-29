package com.omnishop.sync

import com.omnishop.core.OrderItem
import com.omnishop.core.PurchaseOrder
import com.omnishop.data.OrderPrivateService
import com.omnishop.data.ReceiptService
import com.omnishop.data.SecretStore
import com.omnishop.data.ShoppingStore
import com.omnishop.data.SyncResult
import com.omnishop.data.inMemory
import com.omnishop.data.security.JcaBackupCrypto
import kotlinx.coroutines.runBlocking
import kotlin.test.*

class TlsSyncServiceTest {
    private class MemorySecrets : SecretStore {
        private val values = mutableMapOf<String, ByteArray>()
        override fun get(key: String): ByteArray? = values[key]?.copyOf()
        override fun set(key: String, value: ByteArray) { values[key] = value.copyOf() }
        override fun delete(key: String) { values.remove(key) }
    }

    @Test fun pairsSyncsBothWaysAndRejectsRevokedPeers() = runBlocking {
        ShoppingStore.inMemory("a") { 300 }.use { aStore ->
            ShoppingStore.inMemory("b") { 300 }.use { bStore ->
                val crypto = JcaBackupCrypto()
                val aSecrets = MemorySecrets()
                val bSecrets = MemorySecrets()
                val aReceipts = ReceiptService(OrderPrivateService(aStore, aSecrets, crypto), aStore, { "receipt-a" }) { 300 }
                val bReceipts = ReceiptService(OrderPrivateService(bStore, bSecrets, crypto), bStore, { "receipt-b" }) { 300 }
                val a = TlsSyncService(aStore, aSecrets, crypto, aReceipts, port = 0) { 300 }
                val b = TlsSyncService(bStore, bSecrets, crypto, bReceipts, port = 0) { 300 }
                try {
                    val code = a.createPairing()
                    val paired = b.pair(code.code)
                    assertIs<SyncResult.Success>(paired)
                    assertNotNull(paired.sas)
                    assertEquals(paired.sas, a.peers().single().sas)
                    assertEquals(1, a.peers().size)
                    assertEquals(a.thisDevice().deviceId, b.peers().single().deviceId)

                    val order = PurchaseOrder("o", "Shop", listOf(OrderItem("i", "Tablet", 1)))
                    aStore.createOrder(order, 300)
                    bStore.createOrder(order, 300)
                    aStore.setPreference("language", "THAI")
                    aStore.saveProduct(com.omnishop.data.SavedProduct("p", "Tablet", null, 90))
                    val receiptBytes = byteArrayOf(4, 5, 6)
                    aReceipts.save("o", "invoice.pdf", "application/pdf", receiptBytes)
                    val first = b.sync(a.thisDevice().deviceId)
                    assertIs<SyncResult.Success>(first)
                    assertEquals("THAI", bStore.preference("language"))
                    assertEquals("Tablet", bStore.listProducts().single().title)
                    assertContentEquals(receiptBytes, bReceipts.read("o", "receipt-a"))

                    bStore.setPreference("theme", "dark")
                    assertIs<SyncResult.Success>(b.sync(a.thisDevice().deviceId))
                    assertEquals("dark", aStore.preference("theme"))

                    a.revoke(b.thisDevice().deviceId)
                    val denied = b.sync(a.thisDevice().deviceId)
                    assertTrue(denied is SyncResult.Failure)
                } finally {
                    a.close()
                    b.close()
                }
            }
        }
    }

    @Test fun attributesLocalWritesToSyncIdentity() = runBlocking {
        ShoppingStore.inMemory("local") { 300 }.use { store ->
            store.setPreference("legacy-local", "yes")
            val service = TlsSyncService(
                store, MemorySecrets(), JcaBackupCrypto(),
                enableDiscovery = false, enableServer = false, port = 0,
            ) { 300 }
            try {
                store.setPreference("origin-check", "yes")
                assertEquals(
                    service.thisDevice().deviceId,
                    store.syncMeta("settings", "origin-check")!!.originDevice,
                )
                assertEquals(
                    service.thisDevice().deviceId,
                    store.syncMeta("settings", "legacy-local")!!.originDevice,
                )
            } finally {
                service.close()
            }
        }
    }

    @Test fun clientOnlyServiceSyncsWithoutListening() = runBlocking {
        ShoppingStore.inMemory("a") { 300 }.use { aStore ->
            ShoppingStore.inMemory("b") { 300 }.use { bStore ->
                val a = TlsSyncService(aStore, MemorySecrets(), JcaBackupCrypto(), enableDiscovery = false, port = 0) { 300 }
                val b = TlsSyncService(
                    bStore, MemorySecrets(), JcaBackupCrypto(),
                    enableDiscovery = false, enableServer = false, port = 0,
                ) { 300 }
                try {
                    val code = a.createPairing()
                    assertIs<SyncResult.Success>(b.pair(code.code))
                    aStore.setPreference("language", "THAI")
                    assertIs<SyncResult.Success>(b.sync(a.thisDevice().deviceId))
                    assertEquals("THAI", bStore.preference("language"))
                } finally {
                    a.close()
                    b.close()
                }
            }
        }
    }

    @Test fun rejectsExpiredAndUnsupportedPairingCodes() = runBlocking {
        ShoppingStore.inMemory("b") { 300 }.use { store ->
            val service = TlsSyncService(
                store, MemorySecrets(), JcaBackupCrypto(),
                enableDiscovery = false, enableServer = false, port = 0,
            ) { 300 }
            try {
                val expired = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                    """{"version":1,"deviceId":"x","fingerprint":"f","host":"127.0.0.1","port":1,"secret":"s","expiresAt":1}"""
                        .encodeToByteArray(),
                )
                val expiredResult = service.pair(expired)
                assertIs<SyncResult.Failure>(expiredResult)
                assertTrue(expiredResult.message.contains("expired"))

                val unsupported = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                    """{"version":2,"deviceId":"x","fingerprint":"f","host":"127.0.0.1","port":1,"secret":"s","expiresAt":9999999999999}"""
                        .encodeToByteArray(),
                )
                val unsupportedResult = service.pair(unsupported)
                assertIs<SyncResult.Failure>(unsupportedResult)
                assertTrue(unsupportedResult.message.contains("Unsupported"))
            } finally {
                service.close()
            }
        }
    }

    @Test fun rejectsMalformedPairingCodes() = runBlocking {
        ShoppingStore.inMemory("a") { 300 }.use { store ->
            val service = TlsSyncService(store, MemorySecrets(), JcaBackupCrypto(), enableDiscovery = false, port = 0) { 300 }
            try {
                assertIs<SyncResult.Failure>(service.pair("not-a-code"))
                assertTrue(service.peers().isEmpty())
            } finally {
                service.close()
            }
        }
    }
}
