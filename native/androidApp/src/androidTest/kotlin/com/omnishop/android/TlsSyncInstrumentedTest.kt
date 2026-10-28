package com.omnishop.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.omnishop.data.OrderPrivateService
import com.omnishop.data.ReceiptService
import com.omnishop.data.ShoppingStore
import com.omnishop.data.SyncResult
import com.omnishop.data.openAndroid
import com.omnishop.data.security.JcaBackupCrypto
import com.omnishop.sync.TlsSyncService
import java.util.UUID
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TlsSyncInstrumentedTest {
    @Test fun pairsAndSyncsWithDesktopHarness() = runBlocking {
        val code = InstrumentationRegistry.getArguments().getString("pairingCode")
            ?: error("Pass the pairing code with -e pairingCode <code>")
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val store = ShoppingStore.openAndroid(context)
        val secrets = AndroidSecretStore(context)
        val crypto = JcaBackupCrypto()
        val privateService = OrderPrivateService(store, secrets, crypto)
        val receipts = ReceiptService(privateService, store, { UUID.randomUUID().toString() })
        val service = TlsSyncService(
            store, secrets, crypto, receipts,
            displayName = "Android test",
            enableDiscovery = false,
            enableServer = false,
        )
        try {
            val paired = service.pair(code)
            assertTrue("Pair failed: ${(paired as? SyncResult.Failure)?.message}", paired is SyncResult.Success)
            val host = requireNotNull(service.peers().maxByOrNull { it.lastSyncAtEpochMillis })
            val synced = service.sync(host.deviceId)
            assertTrue("Sync failed: ${(synced as? SyncResult.Failure)?.message}", synced is SyncResult.Success)
            assertTrue(store.listProducts().any { it.title == "HARNESS DESKTOP PRODUCT" })
        } finally {
            service.close()
            store.close()
        }
    }
}
