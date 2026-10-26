package com.omnishop.data

import com.omnishop.core.*
import com.omnishop.data.security.JcaBackupCrypto
import kotlin.test.*

class ReceiptServiceTest {
    private val crypto = JcaBackupCrypto()
    private val order = PurchaseOrder("o", "Shop", listOf(OrderItem("i", "Tablet", 1)))

    private fun service(store: ShoppingStore, secrets: SecretStore = InMemorySecretStore()): Pair<ReceiptService, OrderPrivateService> {
        val privateService = OrderPrivateService(store, secrets, crypto)
        var id = 0
        return ReceiptService(privateService, { "receipt-${++id}" }) { 100L } to privateService
    }

    @Test fun encryptsListsReadsAndDeletesReceipts() {
        ShoppingStore.inMemory().use { store ->
            store.createOrder(order, 100)
            val (receipts, _) = service(store)
            val bytes = byteArrayOf(1, 2, 3, 4, 5)
            val metadata = receipts.save("o", "Invoice.pdf", "application/pdf", bytes)
            assertEquals(metadata, receipts.list("o").single())
            assertContentEquals(bytes, receipts.read("o", metadata.id))
            val raw = store.privateField("o", "receipt.${metadata.id}")!!
            assertFalse(raw.ciphertext.decodeToString().contains("Invoice.pdf"))
            receipts.delete("o", metadata.id)
            assertTrue(receipts.list("o").isEmpty())
            assertNull(receipts.read("o", metadata.id))
        }
    }

    @Test fun rejectsMissingOrdersEmptyFilesOversizeAndInvalidNames() {
        ShoppingStore.inMemory().use { store ->
            store.createOrder(order, 100)
            val (receipts, _) = service(store)
            assertFailsWith<IllegalArgumentException> { receipts.save("missing", "x", null, byteArrayOf(1)) }
            assertFailsWith<IllegalArgumentException> { receipts.save("o", " ", null, byteArrayOf(1)) }
            assertFailsWith<IllegalArgumentException> { receipts.save("o", "x", null, ByteArray(0)) }
            assertFailsWith<IllegalArgumentException> { receipts.save("o", "x", null, ByteArray(ReceiptService.MAX_BYTES + 1)) }
        }
    }

    @Test fun receiptsSurviveEncryptedBackupAndRestore() {
        val password = "backup password".toCharArray()
        ShoppingStore.inMemory().use { source ->
            source.createOrder(order, 100)
            val (sourceReceipts, sourcePrivate) = service(source)
            val bytes = ByteArray(2_000) { (it % 251).toByte() }
            sourceReceipts.save("o", "warranty.pdf", "application/pdf", bytes)
            val backup = BackupService(source, crypto, sourcePrivate).export(password, 200)
            ShoppingStore.inMemory().use { target ->
                target.createOrder(order, 100)
                val (targetReceipts, targetPrivate) = service(target)
                BackupService(target, crypto, targetPrivate).restore(backup, password)
                assertContentEquals(bytes, targetReceipts.read("o", "receipt-1"))
            }
        }
    }

    @Test fun failedRestoreDoesNotReplaceReceipts() {
        val password = "backup password".toCharArray()
        ShoppingStore.inMemory().use { source ->
            source.createOrder(order, 100)
            val (sourceReceipts, sourcePrivate) = service(source)
            sourceReceipts.save("o", "a.pdf", null, byteArrayOf(1, 2))
            val backup = BackupService(source, crypto, sourcePrivate).export(password, 200)
            ShoppingStore.inMemory().use { target ->
                target.createOrder(order, 100)
                val (targetReceipts, targetPrivate) = service(target)
                targetReceipts.save("o", "keep.pdf", null, byteArrayOf(9))
                assertFailsWith<Exception> {
                    BackupService(target, crypto, targetPrivate).restore(backup, "wrong password!".toCharArray())
                }
                assertEquals("keep.pdf", targetReceipts.list("o").single().name)
            }
        }
    }
}
