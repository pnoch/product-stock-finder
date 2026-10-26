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

    private fun service(store: ShoppingStore, secrets: SecretStore = InMemorySecretStore()) =
        BackupService(store, crypto, OrderPrivateService(store, secrets, crypto))

    private fun populated(store: ShoppingStore) {
        store.saveProduct(SavedProduct("p1", "Tablet", "https://example.com/tablet", 100))
        store.saveOffer(Offer("l1", "p1", "Seller A", CostEstimate(Money(800010, Currency.THB))), 110)
        store.createOrder(PurchaseOrder(
            "o1", "Shop", listOf(OrderItem("i1", "Tablet", 2, Money(500, Currency.THB))),
            currency = Currency.THB, shipping = Money(100, Currency.THB),
            tax = Money(50, Currency.THB), discount = Money(20, Currency.THB),
            totalPaid = Money(1_130, Currency.THB), merchantOrderId = "MERCHANT-1",
            purchasedAtEpochMillis = 90, paymentMethodLabel = "Visa",
        ), 120)
        store.attachShipment("o1", Shipment("s1", listOf(ShipmentAllocation("i1", 1)), carrierId = "thailandpost"),
            "TRACK1", "Thailand Post", "thailandpost")
        store.recordEvent(TrackingEvent("s1", "manual", "e1", ShipmentStatus.DELIVERED,
            "Received", ObservationMethod.MANUAL, 130))
        store.setPreference("language", "THAI")
    }

    @Test fun roundTripRestoresEveryTableIncludingPreferences() {
        ShoppingStore.inMemory().use { source ->
            populated(source)
            val backup = service(source).export(password, 200)
            ShoppingStore.inMemory().use { target ->
                val counts = service(target).restore(backup, password)
                assertEquals(BackupCounts(products = 1, offers = 1, orders = 1, shipments = 1, events = 1), counts)
                assertEquals(source.snapshot(), target.snapshot())
                assertEquals("thailandpost", target.getOrder("o1")!!.shipments.single().carrierId)
                val restored = target.getOrder("o1")!!
                assertEquals(Money(1_000, Currency.THB), restored.itemSubtotal)
                assertEquals(Money(1_130, Currency.THB), restored.totalPaid)
                assertEquals("MERCHANT-1", restored.merchantOrderId)
                assertEquals("Visa", restored.paymentMethodLabel)
            }
        }
    }

    @Test fun wrongPasswordAndTamperingFailClosed() {
        ShoppingStore.inMemory().use { store ->
            populated(store)
            val backup = service(store).export(password, 200)
            assertFailsWith<BackupAuthenticationException> {
                service(store).restore(backup, "wrong password!".toCharArray())
            }
            val tampered = backup.copyOf().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }
            assertFailsWith<BackupAuthenticationException> {
                service(store).restore(tampered, password)
            }
            val headerTampered = backup.copyOf().also { it[20] = (it[20].toInt() xor 1).toByte() }
            assertFailsWith<BackupAuthenticationException> {
                service(store).restore(headerTampered, password)
            }
            assertFailsWith<BackupAuthenticationException> {
                service(store).restore(backup.copyOf(backup.size - 10), password)
            }
            assertFailsWith<BackupAuthenticationException> {
                service(store).restore(ByteArray(40), password)
            }
        }
    }

    @Test fun shortExportPasswordIsRejected() {
        ShoppingStore.inMemory().use { store ->
            assertFailsWith<IllegalArgumentException> {
                service(store).export("short".toCharArray(), 200)
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
            assertFailsWith<BackupFormatException> { service(store).restore(backup, password) }
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

    @Test fun shippingAddressIsPortableAndReEncryptedForTheNewDevice() {
        val sourceSecrets = InMemorySecretStore()
        val targetSecrets = InMemorySecretStore()
        ShoppingStore.inMemory().use { source ->
            populated(source)
            val sourcePrivate = OrderPrivateService(source, sourceSecrets, crypto)
            sourcePrivate.save("o1", OrderPrivateService.SHIPPING_ADDRESS, "123 Secret Road")
            val backup = BackupService(source, crypto, sourcePrivate).export(password, 200)
            assertFalse(backup.decodeToString().contains("123 Secret Road"))

            ShoppingStore.inMemory().use { target ->
                val targetPrivate = OrderPrivateService(target, targetSecrets, crypto)
                BackupService(target, crypto, targetPrivate).restore(backup, password)
                assertEquals("123 Secret Road", targetPrivate.read("o1", OrderPrivateService.SHIPPING_ADDRESS))
                val sourceRow = source.privateField("o1", OrderPrivateService.SHIPPING_ADDRESS)!!
                val targetRow = target.privateField("o1", OrderPrivateService.SHIPPING_ADDRESS)!!
                assertFalse(sourceRow.ciphertext.contentEquals(targetRow.ciphertext))
            }
        }
    }

    @Test fun exportRejectsEmptySnapshotInsteadOfProducingAnUnusableBackup() {
        ShoppingStore.inMemory().use { store ->
            val backup = service(store).export(password, 200)
            ShoppingStore.inMemory().use { target ->
                target.saveProduct(SavedProduct("keep", "Existing", null, 1))
                val counts = service(target).restore(backup, password)
                assertEquals(BackupCounts(0, 0, 0, 0, 0), counts)
                assertTrue(target.listProducts().isEmpty())
            }
        }
    }
}
