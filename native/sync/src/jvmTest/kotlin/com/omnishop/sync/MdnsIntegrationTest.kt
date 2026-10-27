package com.omnishop.sync

import com.omnishop.data.SecretStore
import com.omnishop.data.ShoppingStore
import com.omnishop.data.SyncResult
import com.omnishop.data.inMemory
import com.omnishop.data.security.JcaBackupCrypto
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlin.test.*

class MdnsIntegrationTest {
    private class MemorySecrets : SecretStore {
        private val values = mutableMapOf<String, ByteArray>()
        override fun get(key: String): ByteArray? = values[key]?.copyOf()
        override fun set(key: String, value: ByteArray) { values[key] = value.copyOf() }
        override fun delete(key: String) { values.remove(key) }
    }

    @Test fun discoversAndPairsNearby(): Unit = runBlocking {
        ShoppingStore.inMemory("a").use { a ->
            ShoppingStore.inMemory("b").use { b ->
                val aSvc = TlsSyncService(a, MemorySecrets(), JcaBackupCrypto(), displayName = "A", port = 0)
                val bSvc = TlsSyncService(b, MemorySecrets(), JcaBackupCrypto(), displayName = "B", port = 0)
                try {
                    val code = aSvc.createPairing()
                    val secret = requireNotNull(code.secret)
                    var peer: com.omnishop.data.SyncDiscoveredPeer? = null
                    val deadline = System.currentTimeMillis() + 10_000
                    while (peer == null && System.currentTimeMillis() < deadline) {
                        delay(200)
                        peer = bSvc.discoveredPeers().firstOrNull { it.deviceId == aSvc.thisDevice().deviceId }
                    }
                    assertNotNull(peer, "mDNS peer was not discovered")
                    val result = bSvc.pairDiscovered(peer.deviceId, secret)
                    assertIs<SyncResult.Success>(result)
                } finally {
                    aSvc.close()
                    bSvc.close()
                }
            }
        }
    }
}
