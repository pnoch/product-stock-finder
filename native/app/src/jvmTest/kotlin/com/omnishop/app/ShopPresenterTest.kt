package com.omnishop.app

import com.omnishop.core.DeliveryProgress
import com.omnishop.core.ShipmentStatus
import com.omnishop.data.ShoppingStore
import com.omnishop.data.inMemory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlin.test.*

class ShopPresenterTest {
    @Test fun localWorkflowCreatesAnOrderAndSplitShipmentWithoutAnAccount() = runBlocking {
        ShoppingStore.inMemory().use { store ->
            var nextId = 0
            var time = 100L
            val presenter = ShopPresenter(store, { "id-${++nextId}" }, { time++ }, Dispatchers.Unconfined)
            presenter.refresh()
            assertTrue(presenter.state.value.products.isEmpty())
            presenter.saveProduct("Tablet", "https://example.com/tablet")
            presenter.createOrder("Local seller", listOf(DraftItem("Tablet", 2)))
            val order = presenter.state.value.selectedOrder!!
            presenter.attachShipment("TRACK-1", "Manual carrier", listOf(order.items.single().id to 1))
            val shipment = presenter.state.value.selectedOrder!!.shipments.single()
            presenter.recordManualEvent(shipment.id, ShipmentStatus.DELIVERED, "Received first package")
            assertEquals(DeliveryProgress.PARTIALLY_DELIVERED, presenter.state.value.selectedOrder!!.deliveryProgress)
            assertEquals("Received first package", presenter.state.value.events[shipment.id]!!.single().description)
            assertNull(presenter.state.value.error)
        }
    }

    @Test fun multipleItemsCanShipSeparatelyAndRemainPartiallyDelivered() = runBlocking {
        ShoppingStore.inMemory().use { store ->
            var id = 0
            val presenter = ShopPresenter(store, { "id-${++id}" }, { 100L }, Dispatchers.Unconfined)
            presenter.createOrder("Shop", listOf(DraftItem("Tablet", 1), DraftItem("Phone", 1)))
            val order = presenter.state.value.selectedOrder!!
            val tablet = order.items.first { it.title == "Tablet" }
            val phone = order.items.first { it.title == "Phone" }

            presenter.attachShipment("TAB-1", "Manual", listOf(tablet.id to 1))
            val packageOne = presenter.state.value.selectedOrder!!.shipments.single()
            presenter.recordManualEvent(packageOne.id, ShipmentStatus.DELIVERED, "Tablet arrived")
            assertEquals(DeliveryProgress.PARTIALLY_DELIVERED, presenter.state.value.selectedOrder!!.deliveryProgress)

            presenter.attachShipment("PHONE-1", "Manual", listOf(phone.id to 1))
            assertEquals(2, presenter.state.value.selectedOrder!!.shipments.size)
            assertEquals(1L, presenter.state.value.selectedOrder!!.deliveredUnits)
        }
    }

    @Test fun overAllocatingAPackageIsRejectedWithoutWritingAShipment() = runBlocking {
        ShoppingStore.inMemory().use { store ->
            var id = 0
            val presenter = ShopPresenter(store, { "id-${++id}" }, { 100L }, Dispatchers.Unconfined)
            presenter.createOrder("Shop", listOf(DraftItem("Tablet", 1)))
            val order = presenter.state.value.selectedOrder!!
            presenter.attachShipment("TRACK", "Manual", listOf(order.items.single().id to 2))
            assertNotNull(presenter.state.value.error)
            assertTrue(store.getOrder(order.id)!!.shipments.isEmpty())
        }
    }

    @Test fun invalidLinkCannotCreateAPartialSavedProduct() = runBlocking {
        ShoppingStore.inMemory().use { store ->
            val presenter = ShopPresenter(store, { "id" }, { 100L }, Dispatchers.Unconfined)
            presenter.saveProduct("Tablet", "javascript:alert(1)")
            assertNotNull(presenter.state.value.error)
            assertTrue(store.listProducts().isEmpty())
            assertFalse(presenter.state.value.busy)
        }
    }

    @Test fun languageChoiceIsStoredAndEveryLabelIsTranslated() = runBlocking {
        ShoppingStore.inMemory().use { store ->
            val presenter = ShopPresenter(store, { "id" }, { 100L }, Dispatchers.Unconfined)
            presenter.changeLanguage(AppLanguage.THAI)
            val reopened = ShopPresenter(store, { "other" }, { 200L }, Dispatchers.Unconfined)
            reopened.refresh()
            assertEquals(AppLanguage.THAI, reopened.state.value.language)
            for (language in AppLanguage.entries) for (label in Label.entries) {
                assertTrue(language.text(label).isNotBlank())
            }
        }
    }

    @Test fun comparingManualOffersPreservesUnknownShippingAndFees() = runBlocking {
        ShoppingStore.inMemory().use { store ->
            var id = 0
            val presenter = ShopPresenter(store, { "id-${++id}" }, { 100L }, Dispatchers.Unconfined)
            presenter.saveProduct("Tablet 256GB", "")
            val product = presenter.state.value.products.single()
            presenter.addOffer(product.id, "Seller A", "8000.10", "")
            presenter.addOffer(product.id, "Seller B", "7999.99", "50.00")
            val offers = presenter.state.value.offers.getValue(product.id)
            assertEquals(2, offers.size)
            assertEquals(800010L, offers[0].estimate.itemPrice.minorUnits)
            assertEquals(com.omnishop.core.Cost.Unknown, offers[0].estimate.shipping)
            offers.forEach { assertNull(it.estimate.total) }
        }
    }
}
