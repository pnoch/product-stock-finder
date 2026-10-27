package com.omnishop.sync

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
                val a = TlsSyncService(aStore, MemorySecrets(), JcaBackupCrypto(), port = 0) { 300 }
                val b = TlsSyncService(bStore, MemorySecrets(), JcaBackupCrypto(), port = 0) { 300 }
                try {
                    val code = a.createPairing()
                    assertIs<SyncResult.Success>(b.pair(code.code))
                    assertEquals(1, a.peers().size)
                    assertEquals(a.thisDevice().deviceId, b.peers().single().deviceId)

                    aStore.setPreference("language", "THAI")
                    aStore.saveProduct(com.omnishop.data.SavedProduct("p", "Tablet", null, 90))
                    val first = b.sync(a.thisDevice().deviceId)
                    assertIs<SyncResult.Success>(first)
                    assertEquals("THAI", bStore.preference("language"))
                    assertEquals("Tablet", bStore.listProducts().single().title)

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

    @Test fun rejectsMalformedPairingCodes() = runBlocking {
        ShoppingStore.inMemory("a") { 300 }.use { store ->
            val service = TlsSyncService(store, MemorySecrets(), JcaBackupCrypto(), port = 0) { 300 }
            try {
                assertIs<SyncResult.Failure>(service.pair("not-a-code"))
                assertTrue(service.peers().isEmpty())
            } finally {
                service.close()
            }
        }
    }
}
