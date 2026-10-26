package com.omnishop.data

import com.omnishop.core.*
import com.omnishop.data.security.BackupAuthenticationException
import com.omnishop.data.security.BackupFormatException
import com.omnishop.data.security.EncryptedBackup
import com.omnishop.data.security.JcaBackupCrypto
import kotlinx.serialization.json.Json
import kotlin.test.*

class EncryptedBackupTest {
    private val crypto = JcaBackupCrypto()
    private val password = "correct horse battery".toCharArray()

    private fun populated(store: ShoppingStore) {
        store.saveProduct(SavedProduct("p1", "Tablet", "https://example.com/tablet", 100))
        store.saveOffer(Offer("l1", "p1", "Seller A", CostEstimate(Money(800010, Currency.THB))), 110)
        store.createOrder(PurchaseOrder("o1", "Shop", listOf(OrderItem("i1", "Tablet", 2))), 120)
        store.attachShipment("o1", Shipment("s1", listOf(ShipmentAllocation("i1", 1))), "TRACK1", "Manual")
        store.recordEvent(TrackingEvent("s1", "manual", "e1", ShipmentStatus.DELIVERED,
            "Received", ObservationMethod.MANUAL, 130))
        store.setPreference("language", "THAI")
    }

    @Test fun roundTripRestoresEveryTableIncludingPreferences() {
        ShoppingStore.inMemory().use { source ->
            populated(source)
            val backup = BackupService(source, crypto).export(password, 200)
            ShoppingStore.inMemory().use { target ->
                val counts = BackupService(target, crypto).restore(backup, password)
                assertEquals(BackupCounts(products = 1, offers = 1, orders = 1, shipments = 1, events = 1), counts)
                assertEquals(source.snapshot(), target.snapshot())
            }
        }
    }

    @Test fun wrongPasswordAndTamperingFailClosed() {
        ShoppingStore.inMemory().use { store ->
            populated(store)
            val backup = BackupService(store, crypto).export(password, 200)
            assertFailsWith<BackupAuthenticationException> {
                BackupService(store, crypto).restore(backup, "wrong password!".toCharArray())
            }
            val tampered = backup.copyOf().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }
            assertFailsWith<BackupAuthenticationException> {
                BackupService(store, crypto).restore(tampered, password)
            }
            val headerTampered = backup.copyOf().also { it[20] = (it[20].toInt() xor 1).toByte() }
            assertFailsWith<BackupAuthenticationException> {
                BackupService(store, crypto).restore(headerTampered, password)
            }
            assertFailsWith<BackupAuthenticationException> {
                BackupService(store, crypto).restore(backup.copyOf(backup.size - 10), password)
            }
            assertFailsWith<BackupAuthenticationException> {
                BackupService(store, crypto).restore(ByteArray(40), password)
            }
        }
    }

    @Test fun shortExportPasswordIsRejected() {
        ShoppingStore.inMemory().use { store ->
            assertFailsWith<IllegalArgumentException> {
                BackupService(store, crypto).export("short".toCharArray(), 200)
            }
        }
    }

    @Test fun invalidSnapshotIsRejectedBeforeAnyWrite() {
        ShoppingStore.inMemory().use { store ->
            populated(store)
            val before = store.snapshot()
            val invalid = BackupSnapshot(
                orders = listOf(BackupOrder("o", "Shop", 1)),
                orderItems = listOf(BackupOrderItem("i", "missing-order", "Tablet", 1)),
            )
            val plaintext = Json.encodeToString(BackupSnapshot.serializer(), invalid).encodeToByteArray()
            val backup = EncryptedBackup.encrypt(plaintext, password, 300, crypto)
            assertFailsWith<BackupFormatException> { BackupService(store, crypto).restore(backup, password) }
            assertEquals(before, store.snapshot())
        }
    }

    @Test fun failedReplaceRollsBackTheExistingDatabase() {
        ShoppingStore.inMemory().use { store ->
            populated(store)
            val before = store.snapshot()
            val invalid = BackupSnapshot(
                orders = listOf(BackupOrder("o", "Shop", 1)),
                orderItems = listOf(BackupOrderItem("i", "missing-order", "Tablet", 1)),
            )
            assertFails { store.replaceAll(invalid) }
            assertEquals(before, store.snapshot())
        }
    }

    @Test fun exportRejectsEmptySnapshotInsteadOfProducingAnUnusableBackup() {
        ShoppingStore.inMemory().use { store ->
            val backup = BackupService(store, crypto).export(password, 200)
            ShoppingStore.inMemory().use { target ->
                target.saveProduct(SavedProduct("keep", "Existing", null, 1))
                val counts = BackupService(target, crypto).restore(backup, password)
                assertEquals(BackupCounts(0, 0, 0, 0, 0), counts)
                assertTrue(target.listProducts().isEmpty())
            }
        }
    }
}
