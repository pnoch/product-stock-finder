package com.omnishop.data

import com.omnishop.core.*
import com.omnishop.data.security.JcaBackupCrypto
import kotlin.test.*

class ReceiptSyncTest {
    private val crypto = JcaBackupCrypto()
    private val order = PurchaseOrder("o", "Shop", listOf(OrderItem("i", "Tablet", 1)))

    private fun receipts(store: ShoppingStore, id: String) =
        ReceiptService(OrderPrivateService(store, InMemorySecretStore(), crypto), store, { id }) { 100L }

    @Test fun syncsEncryptedReceiptsAndTombstones() {
        ShoppingStore.inMemory("a").use { a ->
            ShoppingStore.inMemory("b").use { b ->
                a.createOrder(order, 100)
                b.createOrder(order, 100)
                val source = receipts(a, "receipt-1")
                val target = receipts(b, "receipt-1")
                val bytes = ByteArray(2_000) { (it % 251).toByte() }
                val metadata = source.save("o", "warranty.pdf", "application/pdf", bytes)

                val changes = SyncEngine(a, source).localChanges(SyncCursor.START).changes
                val receiptChange = changes.single { it.collection == "receipts" }
                assertEquals(1, SyncEngine(b, target).apply(listOf(receiptChange)))
                assertContentEquals(bytes, target.read("o", metadata.id))

                source.delete("o", metadata.id)
                val tombstone = SyncEngine(a, source).localChanges(SyncCursor.START).changes.single { it.collection == "receipts" }
                assertNotNull(tombstone.deletedAt)
                assertEquals(1, SyncEngine(b, target).apply(listOf(tombstone)))
                assertNull(target.read("o", metadata.id))
                assertTrue(target.list("o").isEmpty())
            }
        }
    }

    @Test fun receiptIsIncludedInEncryptedSyncPackage() {
        val password = "sync password".toCharArray()
        ShoppingStore.inMemory("a") { 100 }.use { a ->
            ShoppingStore.inMemory("b") { 50 }.use { b ->
                a.createOrder(order, 100)
                b.createOrder(order, 50)
                val source = receipts(a, "receipt-1")
                val target = receipts(b, "receipt-1")
                val bytes = byteArrayOf(9, 8, 7)
                source.save("o", "invoice.pdf", "application/pdf", bytes)

                val packageBytes = SyncPackageService(a, crypto, source) { 300 }.export(password)
                val applied = SyncPackageService(b, crypto, target) { 400 }.import(packageBytes, password)
                assertContentEquals(bytes, target.read("o", "receipt-1"))
                assertEquals(2, applied)
            }
        }
    }
}
