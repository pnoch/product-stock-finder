package com.omnishop.android

import android.content.Context
import android.net.wifi.WifiManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.omnishop.data.SecretStore
import com.omnishop.data.ShoppingStore
import com.omnishop.data.SyncResult
import com.omnishop.data.openAndroid
import com.omnishop.data.security.JcaBackupCrypto
import com.omnishop.sync.TlsSyncService
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MdnsPairingInstrumentedTest {
    private class MemorySecrets : SecretStore {
        private val values = mutableMapOf<String, ByteArray>()
        override fun get(key: String): ByteArray? = values[key]?.copyOf()
        override fun set(key: String, value: ByteArray) { values[key] = value.copyOf() }
        override fun delete(key: String) { values.remove(key) }
    }

    @Test fun discoversAndPairsNearbyDevice(): Unit = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val lock = multicastLock(context)
        val store = ShoppingStore.openAndroid(context)
        val a = TlsSyncService(store, MemorySecrets(), JcaBackupCrypto(), displayName = "mDNS A", port = 0)
        val b = TlsSyncService(store, MemorySecrets(), JcaBackupCrypto(), displayName = "mDNS B", port = 0)
        try {
            val code = a.createPairing()
            val secret = requireNotNull(code.secret)
            var peer: com.omnishop.data.SyncDiscoveredPeer? = null
            val deadline = System.currentTimeMillis() + 20_000
            while (peer == null && System.currentTimeMillis() < deadline) {
                delay(250)
                peer = b.discoveredPeers().firstOrNull { it.deviceId == a.thisDevice().deviceId }
            }
            assertTrue("mDNS did not discover the pairing window", peer != null)
            val paired = b.pairDiscovered(peer!!.deviceId, secret)
            assertTrue("Pairing failed: ${(paired as? SyncResult.Failure)?.message}", paired is SyncResult.Success)
            val synced = b.sync(a.thisDevice().deviceId)
            assertTrue("Sync failed: ${(synced as? SyncResult.Failure)?.message}", synced is SyncResult.Success)
        } finally {
            a.close()
            b.close()
            store.close()
            lock?.release()
        }
    }

    private fun multicastLock(context: Context): WifiManager.MulticastLock? {
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        return wifi?.createMulticastLock("omnishop-mdns-test")?.apply {
            setReferenceCounted(false)
            acquire()
        }
    }
}
