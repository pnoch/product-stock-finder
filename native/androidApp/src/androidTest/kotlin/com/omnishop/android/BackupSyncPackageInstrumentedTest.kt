package com.omnishop.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.omnishop.core.OrderItem
import com.omnishop.core.PurchaseOrder
import com.omnishop.data.BackupService
import com.omnishop.data.OrderPrivateService
import com.omnishop.data.ReceiptService
import com.omnishop.data.ShoppingStore
import com.omnishop.data.SyncPackageService
import com.omnishop.data.openAndroid
import com.omnishop.data.security.JcaBackupCrypto
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BackupSyncPackageInstrumentedTest {
    @Test fun backupAndSyncPackageRoundTrip() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val suffix = System.currentTimeMillis().toString()
        val orderId = "backup-order-$suffix"
        val itemId = "backup-item-$suffix"
        val crypto = JcaBackupCrypto()
        ShoppingStore.openAndroid(context).use { store ->
            val secrets = AndroidSecretStore(context)
            val privateService = OrderPrivateService(store, secrets, crypto)
            val receipts = ReceiptService(privateService, store, { "backup-receipt-$suffix" })
            store.createOrder(
                PurchaseOrder(orderId, "Backup shop", listOf(OrderItem(itemId, "Backup item", 1))),
                System.currentTimeMillis(),
            )
            val receiptBytes = byteArrayOf(7, 8, 9)
            receipts.save(orderId, "receipt.pdf", "application/pdf", receiptBytes)

            val password = "backup-password".toCharArray()
            val backup = BackupService(store, crypto, privateService).export(password, System.currentTimeMillis())
            BackupService(store, crypto, privateService).restore(backup, password)
            assertArrayEquals(receiptBytes, receipts.read(orderId, "backup-receipt-$suffix"))

            val syncPackage = SyncPackageService(store, crypto, receipts).export(password)
            SyncPackageService(store, crypto, receipts).import(syncPackage, password)
            assertArrayEquals(receiptBytes, receipts.read(orderId, "backup-receipt-$suffix"))
        }
    }
}
