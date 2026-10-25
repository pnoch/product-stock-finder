package com.omnishop.data

import com.omnishop.core.*
import java.nio.file.Files
import kotlin.test.*

class ShoppingStoreTest {
    private val item = OrderItem("i", "Tablet", 2)
    private val order = PurchaseOrder("o", "Shop", listOf(item))

    @Test fun persistsOrdersAndManualTimelineAcrossRestart() {
        val file = Files.createTempDirectory("omnishop-test").resolve("shop.db").toFile()
        try {
            ShoppingStore.open(file).use { store ->
                store.createOrder(order, 100)
                store.attachShipment("o", Shipment("s", listOf(ShipmentAllocation("i", 1))), "TRACK", "Manual")
                store.recordEvent(TrackingEvent("s", "manual", "e", ShipmentStatus.DELIVERED, "Received", ObservationMethod.MANUAL, 200))
            }
            ShoppingStore.open(file).use { store ->
                assertEquals(DeliveryProgress.PARTIALLY_DELIVERED, store.getOrder("o")!!.deliveryProgress)
                assertEquals("Received", store.events("s").single().description)
                assertEquals(listOf("o"), store.listOrders().map { it.id })
            }
        } finally {
            file.parentFile.deleteRecursively()
        }
    }

    @Test fun duplicateEventDoesNotOverwriteManualTextOrRegressShipment() {
        ShoppingStore.inMemory().use { store ->
            store.createOrder(order, 100)
            store.attachShipment("o", Shipment("s", listOf(ShipmentAllocation("i", 1))), "TRACK", "Manual")
            val event = TrackingEvent("s", "manual", "e", ShipmentStatus.DELIVERED, "Received", ObservationMethod.MANUAL, 200)
            assertTrue(store.recordEvent(event))
            assertFalse(store.recordEvent(event.copy(status = ShipmentStatus.IN_TRANSIT, description = "Changed")))
            assertEquals(listOf(event), store.events("s"))
            assertEquals(ShipmentStatus.DELIVERED, store.getOrder("o")!!.shipments.single().status)
        }
    }

    @Test fun rejectedShipmentLeavesNoPartialDatabaseWrites() {
        ShoppingStore.inMemory().use { store ->
            store.createOrder(order, 100)
            store.attachShipment("o", Shipment("a", listOf(ShipmentAllocation("i", 2))), "A", "Manual")
            assertFailsWith<IllegalArgumentException> {
                store.attachShipment("o", Shipment("b", listOf(ShipmentAllocation("i", 1))), "B", "Manual")
            }
            assertEquals(listOf("a"), store.getOrder("o")!!.shipments.map { it.id })
        }
    }

    @Test fun rollsBackOrderIfAnItemInsertFails() {
        ShoppingStore.inMemory().use { store ->
            store.createOrder(order, 100)
            assertFails {
                store.createOrder(PurchaseOrder("other", "Other shop", listOf(item)), 200)
            }
            assertNull(store.getOrder("other"))
            assertEquals(listOf("o"), store.listOrders().map { it.id })
        }
    }

    @Test fun startsEmptyAndPaginatesSavedProducts() {
        ShoppingStore.inMemory().use { store ->
            assertTrue(store.listProducts().isEmpty())
            store.saveProduct(SavedProduct("a", "Tablet", null, 100))
            store.saveProduct(SavedProduct("b", "Phone", "https://example.com/phone", 200))
            assertEquals("b", store.listProducts(limit = 1).single().id)
            assertEquals("a", store.listProducts(limit = 1, offset = 1).single().id)
            assertFailsWith<IllegalArgumentException> { store.listProducts(limit = 1001) }
        }
    }

    @Test fun lateCarrierHistoryCannotRewindTheCurrentStatus() {
        ShoppingStore.inMemory().use { store ->
            store.createOrder(order, 100)
            store.attachShipment("o", Shipment("s", listOf(ShipmentAllocation("i", 1))), "TRACK", "Carrier")
            store.recordEvent(TrackingEvent("s", "carrier", "delivered", ShipmentStatus.DELIVERED,
                "Delivered", ObservationMethod.PROVIDER, 400, occurredAtEpochMillis = 300))
            store.recordEvent(TrackingEvent("s", "carrier", "pickup", ShipmentStatus.PICKED_UP,
                "Picked up", ObservationMethod.PROVIDER, 500, occurredAtEpochMillis = 200))
            assertEquals(ShipmentStatus.DELIVERED, store.getOrder("o")!!.shipments.single().status)
            assertEquals(listOf("pickup", "delivered"), store.events("s").map { it.sourceEventId })
        }
    }
}
