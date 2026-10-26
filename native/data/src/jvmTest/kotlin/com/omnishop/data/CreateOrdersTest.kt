package com.omnishop.data

import com.omnishop.core.*
import kotlin.test.*

class CreateOrdersTest {
    @Test fun importsSeveralOrdersInOneTransaction() {
        ShoppingStore.inMemory().use { store ->
            val first = PurchaseOrder("o1", "Shop", listOf(OrderItem("i1", "One", 1)), merchantOrderId = "M1")
            val second = PurchaseOrder("o2", "Shop", listOf(OrderItem("i2", "Two", 1)), merchantOrderId = "M2")
            store.createOrders(listOf(first, second), 100)
            assertEquals("M1", store.findOrderByMerchantId("Shop", "M1")!!.merchantOrderId)
            assertEquals("M2", store.findOrderByMerchantId("Shop", "M2")!!.merchantOrderId)
            assertNull(store.findOrderByMerchantId("Shop", "M3"))
        }
    }

    @Test fun rollsBackAllOrdersWhenOneInsertFails() {
        ShoppingStore.inMemory().use { store ->
            val first = PurchaseOrder("same", "Shop", listOf(OrderItem("i1", "One", 1)), merchantOrderId = "M1")
            val duplicate = PurchaseOrder("same", "Shop", listOf(OrderItem("i2", "Two", 1)), merchantOrderId = "M2")
            assertFails { store.createOrders(listOf(first, duplicate), 100) }
            assertTrue(store.listOrders().isEmpty())
        }
    }
}
