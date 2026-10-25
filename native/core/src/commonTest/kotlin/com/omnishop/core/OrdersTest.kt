package com.omnishop.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class OrdersTest {
    private val item = OrderItem("item", "Tablet", 2)
    private fun shipment(id: String, status: ShipmentStatus, quantity: Int = 1) =
        Shipment(id, listOf(ShipmentAllocation(item.id, quantity)), status)

    @Test fun startsUnshipped() {
        assertEquals(DeliveryProgress.NOT_SHIPPED, PurchaseOrder("o", "Shop", listOf(item)).deliveryProgress)
    }

    @Test fun splitDeliveryDoesNotCompleteTheOrder() {
        val order = PurchaseOrder("o", "Shop", listOf(item), listOf(
            shipment("a", ShipmentStatus.DELIVERED), shipment("b", ShipmentStatus.IN_TRANSIT),
        ))
        assertEquals(DeliveryProgress.PARTIALLY_DELIVERED, order.deliveryProgress)
        assertEquals(1L, order.deliveredUnits)
    }

    @Test fun completesOnlyWhenAllQuantitiesAreDelivered() {
        val order = PurchaseOrder("o", "Shop", listOf(item), listOf(shipment("a", ShipmentStatus.DELIVERED, 2)))
        assertEquals(DeliveryProgress.DELIVERED, order.deliveryProgress)
    }

    @Test fun rejectsOverAllocationAcrossPackages() {
        assertFailsWith<IllegalArgumentException> {
            PurchaseOrder("o", "Shop", listOf(item), listOf(
                shipment("a", ShipmentStatus.IN_TRANSIT, 2), shipment("b", ShipmentStatus.DELIVERED),
            ))
        }
    }

    @Test fun rejectsForeignOrderItemsAndDuplicateIdentifiers() {
        assertFailsWith<IllegalArgumentException> {
            PurchaseOrder("o", "Shop", listOf(item), listOf(Shipment("a", listOf(ShipmentAllocation("foreign", 1)))))
        }
        assertFailsWith<IllegalArgumentException> { PurchaseOrder("o", "Shop", listOf(item, item)) }
        assertFailsWith<IllegalArgumentException> {
            PurchaseOrder("o", "Shop", listOf(item), listOf(shipment("a", ShipmentStatus.UNKNOWN), shipment("a", ShipmentStatus.UNKNOWN)))
        }
    }

    @Test fun rejectsInvalidQuantities() {
        assertFailsWith<IllegalArgumentException> { OrderItem("i", "Tablet", 0) }
        assertFailsWith<IllegalArgumentException> { ShipmentAllocation("i", -1) }
    }

    @Test fun doesNotCountReturnedOrCancelledPackagesAsDelivered() {
        val order = PurchaseOrder("o", "Shop", listOf(item), listOf(shipment("a", ShipmentStatus.RETURNED, 2)))
        assertEquals(0L, order.deliveredUnits)
    }

    @Test fun duplicateEventImportKeepsTheExistingObservation() {
        val event = TrackingEvent("s", "manual", "e", ShipmentStatus.DELIVERED, "Received", ObservationMethod.MANUAL, 100)
        assertEquals(listOf(event), mergeTrackingEvents(listOf(event), listOf(event.copy(description = "Changed"))))
        assertEquals(2, mergeTrackingEvents(listOf(event), listOf(event.copy(shipmentId = "other"))).size)
    }

    @Test fun sourceCapabilitiesDoNotClaimUnimplementedNativeSearch() {
        ShoppingSources.initial.forEach {
            assertEquals(Capability.EXTERNAL_SEARCH_ONLY, it.search)
            assertEquals(Capability.LINK_IMPORT_ONLY, it.importUrl)
        }
    }
}
