package com.omnishop.data

import com.omnishop.core.*
import com.omnishop.data.security.JcaBackupCrypto
import kotlin.test.*

class OrderSyncTest {
    private val crypto = JcaBackupCrypto()

    private fun createOrder(store: ShoppingStore) {
        store.createOrder(PurchaseOrder(
            "o", "Shop", listOf(OrderItem("i", "Tablet", 2, Money(10_000, Currency.THB))),
            currency = Currency.THB, shipping = Money(500, Currency.THB), tax = Money(700, Currency.THB),
            discount = Money(200, Currency.THB), totalPaid = Money(21_000, Currency.THB),
            merchantOrderId = "M1", purchasedAtEpochMillis = 90, paymentMethodLabel = "Visa",
        ), 90)
        store.attachShipment("o",
            Shipment("s", listOf(ShipmentAllocation("i", 1)), ShipmentStatus.SHIPPED, "thailandpost"),
            "TRACK", "Thailand Post", "thailandpost")
        store.recordEvent(TrackingEvent("s", "manual", "e", ShipmentStatus.DELIVERED,
            "Received", ObservationMethod.MANUAL, 100))
        store.createReturn(ReturnRecord("r", "o", "i", 1, "Damaged",
            ReturnStatus.REQUESTED, 110))
    }

    @Test fun syncsTheWholeOrderAggregate() {
        ShoppingStore.inMemory("a") { 100 }.use { a ->
            ShoppingStore.inMemory("b") { 200 }.use { b ->
                createOrder(a)
                val batch = SyncEngine(a).localChanges(SyncCursor.START)
                assertEquals(1, batch.changes.size)
                assertEquals(1, SyncEngine(b).apply(batch.changes))
                val restored = b.getOrder("o")!!
                assertEquals("Shop", restored.merchant)
                assertEquals(Money(10_000, Currency.THB), restored.items.single().unitPrice)
                assertEquals("thailandpost", restored.shipments.single().carrierId)
                assertEquals(ShipmentStatus.DELIVERED, b.events("s").single().status)
                assertEquals(ReturnStatus.REQUESTED, b.returnsForOrder("o").single().status)
                assertEquals("M1", restored.merchantOrderId)
            }
        }
    }

    @Test fun remoteOrderUpdateKeepsLocalPrivateFields() {
        var timeA = 100L
        ShoppingStore.inMemory("a") { timeA }.use { a ->
            ShoppingStore.inMemory("b") { 200 }.use { b ->
                createOrder(a)
                SyncEngine(b).apply(SyncEngine(a).localChanges(SyncCursor.START).changes)
                val bPrivate = OrderPrivateService(b, InMemorySecretStore(), crypto)
                bPrivate.save("o", OrderPrivateService.SHIPPING_ADDRESS, "123 Secret Road")

                timeA = 200
                a.updateOrderFinancials("o", Currency.THB, Money(500, Currency.THB),
                    Money(700, Currency.THB), Money(200, Currency.THB), Money(20_000, Currency.THB),
                    "M1", 90, "Visa")
                val update = SyncEngine(a).localChanges(SyncCursor(100, "a", "o")).changes.single()
                assertEquals(1, SyncEngine(b).apply(listOf(update)))
                assertEquals("123 Secret Road", bPrivate.read("o", OrderPrivateService.SHIPPING_ADDRESS))
                assertEquals(Money(20_000, Currency.THB), b.getOrder("o")!!.totalPaid)
            }
        }
    }

    @Test fun deletesOrderTombstoneAndRejectsMalformedPayloads() {
        var timeA = 100L
        ShoppingStore.inMemory("a") { timeA }.use { a ->
            ShoppingStore.inMemory("b") { 200 }.use { b ->
                createOrder(a)
                SyncEngine(b).apply(SyncEngine(a).localChanges(SyncCursor.START).changes)
                timeA = 200
                a.deleteOrder("o")
                val tombstone = SyncEngine(a).localChanges(SyncCursor.START).changes.single()
                assertEquals(1, SyncEngine(b).apply(listOf(tombstone)))
                assertNull(b.getOrder("o"))
                assertTrue(b.events("s").isEmpty())
                assertTrue(b.returnsForOrder("o").isEmpty())

                assertFails { SyncEngine(b).apply(listOf(SyncChange("orders", "bad", 300, "a", null, "{}"))) }
                assertNull(b.getOrder("bad"))
            }
        }
    }
}
