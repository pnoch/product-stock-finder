package com.omnishop.data

import com.omnishop.core.*
import com.omnishop.data.security.BackupFormatException
import com.omnishop.data.security.JcaBackupCrypto
import kotlinx.serialization.json.Json
import com.omnishop.data.security.EncryptedBackup
import java.nio.file.Files
import kotlin.test.*

class ReturnsStoreTest {
    private fun order(id: String = "o", quantity: Int = 2) =
        PurchaseOrder(id, "Shop", listOf(OrderItem("item-$id", "Tablet", quantity)))

    private fun returned(id: String = "r", orderId: String = "o", quantity: Int = 1) =
        ReturnRecord(id, orderId, "item-$orderId", quantity, "Damaged", ReturnStatus.REQUESTED, 100)

    @Test fun returnAndRefundSurviveAFileDatabaseRestart() {
        val file = Files.createTempDirectory("omnishop-returns").resolve("shop.db").toFile()
        try {
            ShoppingStore.open(file).use { store ->
                store.createOrder(order(), 1)
                store.createReturn(returned())
                store.updateReturn("r", ReturnStatus.PARTIALLY_REFUNDED, Money(12345, Currency.THB), "RETURN-1", "Remaining refund pending")
            }
            ShoppingStore.open(file).use { store ->
                val saved = store.returnsForOrder("o").single()
                assertEquals(ReturnStatus.PARTIALLY_REFUNDED, saved.status)
                assertEquals(Money(12345, Currency.THB), saved.refund)
                assertEquals("RETURN-1", saved.returnTrackingNumber)
                assertEquals("Remaining refund pending", saved.notes)
            }
        } finally {
            file.parentFile.deleteRecursively()
        }
    }

    @Test fun rejectsOverReturnWithoutOverflowOrPartialWrites() {
        ShoppingStore.inMemory().use { store ->
            store.createOrder(order(quantity = Int.MAX_VALUE), 1)
            store.createReturn(returned(quantity = Int.MAX_VALUE))
            assertFailsWith<IllegalArgumentException> { store.createReturn(returned(id = "overflow")) }
            assertEquals(listOf("r"), store.returnsForOrder("o").map { it.id })
        }
    }

    @Test fun rejectedRequestDoesNotPreventAReplacementRequest() {
        ShoppingStore.inMemory().use { store ->
            store.createOrder(order(quantity = 1), 1)
            store.createReturn(returned())
            store.updateReturn("r", ReturnStatus.REJECTED, null, null, null)
            store.createReturn(returned(id = "retry"))
            assertEquals(2, store.returnsForOrder("o").size)
            assertFailsWith<IllegalArgumentException> {
                store.updateReturn("r", ReturnStatus.APPROVED, null, null, null)
            }
            assertEquals(ReturnStatus.REJECTED, store.returnsForOrder("o").first { it.id == "r" }.status)
        }
    }

    @Test fun invalidRefundUpdateKeepsThePreviousReturn() {
        ShoppingStore.inMemory().use { store ->
            store.createOrder(order(), 1)
            store.createReturn(returned())
            assertFailsWith<IllegalArgumentException> { store.updateReturn("r", ReturnStatus.REFUNDED, null, null, null) }
            assertFailsWith<IllegalArgumentException> {
                store.updateReturn("r", ReturnStatus.PROCESSING, Money(-1, Currency.THB), null, null)
            }
            assertEquals(returned(), store.returnsForOrder("o").single())
        }
    }

    @Test fun encryptedBackupRestoresReturnsFromMoreThanOneOrder() {
        val crypto = JcaBackupCrypto()
        val password = "backup password".toCharArray()
        fun service(store: ShoppingStore) = BackupService(store, crypto, OrderPrivateService(store, InMemorySecretStore(), crypto))
        ShoppingStore.inMemory().use { source ->
            source.createOrder(order(), 1)
            source.createOrder(order("other"), 2)
            source.createReturn(returned())
            source.createReturn(returned("other-return", "other"))
            source.updateReturn("r", ReturnStatus.REFUNDED, Money(9900, Currency.THB), null, "Recorded payment")
            val backup = service(source).export(password, 200)
            ShoppingStore.inMemory().use { target ->
                val counts = service(target).restore(backup, password)
                assertEquals(2, counts.returns)
                assertEquals(source.snapshot(), target.snapshot())
                assertEquals(source.returnsForOrder("o"), target.returnsForOrder("o"))
                assertEquals(source.returnsForOrder("other"), target.returnsForOrder("other"))
            }
        }
    }

    @Test fun invalidReturnReferencesInABackupDoNotChangeTheTarget() {
        val crypto = JcaBackupCrypto()
        val password = "backup password".toCharArray()
        ShoppingStore.inMemory().use { store ->
            store.createOrder(order(), 1)
            store.createOrder(order("other"), 2)
            store.createReturn(returned())
            val before = store.snapshot()
            val valid = before.returns.single()
            val invalid = before.copy(returns = listOf(valid.copy(orderId = "other")))
            val bytes = EncryptedBackup.encrypt(Json.encodeToString(BackupSnapshot.serializer(), invalid).encodeToByteArray(), password, 200, crypto)
            val service = BackupService(store, crypto, OrderPrivateService(store, InMemorySecretStore(), crypto))
            assertFailsWith<BackupFormatException> { service.restore(bytes, password) }
            assertEquals(before, store.snapshot())
        }
    }

    @Test fun invalidRefundPayloadFailsBeforeReplacingExistingData() {
        val crypto = JcaBackupCrypto()
        val password = "backup password".toCharArray()
        ShoppingStore.inMemory().use { store ->
            store.createOrder(order(), 1)
            store.createReturn(returned())
            val before = store.snapshot()
            val item = before.returns.single()
            val invalidRecords = listOf(
                item.copy(refundMinor = -1, currencyCode = "THB", currencyScale = 2),
                item.copy(status = "REFUNDED"),
                item.copy(notes = "x".repeat(2001)),
                item.copy(quantity = 3),
            )
            val service = BackupService(store, crypto, OrderPrivateService(store, InMemorySecretStore(), crypto))
            invalidRecords.forEach { invalid ->
                val payload = before.copy(returns = listOf(invalid))
                val bytes = EncryptedBackup.encrypt(Json.encodeToString(BackupSnapshot.serializer(), payload).encodeToByteArray(), password, 200, crypto)
                assertFailsWith<BackupFormatException> { service.restore(bytes, password) }
                assertEquals(before, store.snapshot())
            }
        }
    }

    @Test fun previousBackupPayloadWithoutReturnsStillRestores() {
        val crypto = JcaBackupCrypto()
        val password = "backup password".toCharArray()
        ShoppingStore.inMemory().use { source ->
            source.createOrder(order(), 1)
            val versionOne = source.snapshot().copy(schemaVersion = 1)
            val bytes = EncryptedBackup.encrypt(Json.encodeToString(BackupSnapshot.serializer(), versionOne).encodeToByteArray(), password, 200, crypto)
            ShoppingStore.inMemory().use { target ->
                val service = BackupService(target, crypto, OrderPrivateService(target, InMemorySecretStore(), crypto))
                service.restore(bytes, password)
                assertNotNull(target.getOrder("o"))
                assertTrue(target.returnsForOrder("o").isEmpty())
            }
        }
    }
}
