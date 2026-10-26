package com.omnishop.app

import com.omnishop.core.DeliveryProgress
import com.omnishop.core.ShipmentStatus
import com.omnishop.core.ReturnStatus
import com.omnishop.core.Currency
import com.omnishop.core.Money
import com.omnishop.carriers.CarrierEvent
import com.omnishop.core.ObservationMethod
import com.omnishop.data.ShoppingStore
import com.omnishop.data.inMemory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlin.test.*

class ShopPresenterTest {
    @Test fun recordsAReturnAndPartialRefundOnTheSelectedOrder() = runBlocking {
        ShoppingStore.inMemory().use { store ->
            var id = 0
            val presenter = ShopPresenter(store, { "id-${++id}" }, { 100L }, Dispatchers.Unconfined)
            presenter.createOrder("Shop", listOf(DraftItem("Tablet", 2)))
            presenter.createReturn(presenter.state.value.selectedOrder!!.items.single().id, 1, "Damaged screen")
            val record = presenter.state.value.returns.single()
            assertEquals(ReturnStatus.REQUESTED, record.status)
            presenter.updateReturn(record.id, ReturnStatus.PARTIALLY_REFUNDED, "150.25", "RETURN-1", "Balance pending")
            assertNull(presenter.state.value.error)
            val updated = presenter.state.value.returns.single()
            assertEquals(Money(15025, Currency.THB), updated.refund)
            assertEquals("RETURN-1", updated.returnTrackingNumber)
            presenter.selectOrder(null)
            assertTrue(presenter.state.value.returns.isEmpty())
            presenter.selectOrder(record.orderId)
            assertEquals(updated, presenter.state.value.returns.single())
        }
    }

    @Test fun preventsReturnUpdatesThroughAnotherSelectedOrderAndPreservesCurrency() = runBlocking {
        ShoppingStore.inMemory().use { store ->
            var id = 0
            val presenter = ShopPresenter(store, { "id-${++id}" }, { 100L }, Dispatchers.Unconfined)
            presenter.createOrder("Shop", listOf(DraftItem("Tablet", 1)))
            val order = presenter.state.value.selectedOrder!!
            presenter.createReturn(order.items.single().id, 1, "Damaged")
            val record = presenter.state.value.returns.single()
            store.updateReturn(record.id, ReturnStatus.PARTIALLY_REFUNDED, Money(1200, Currency.USD), null, null)
            presenter.updateReturn(record.id, ReturnStatus.REFUNDED, "20.25", "", "")
            assertEquals(Money(2025, Currency.USD), presenter.state.value.returns.single().refund)
            presenter.createOrder("Other shop", listOf(DraftItem("Phone", 1)))
            presenter.updateReturn(record.id, ReturnStatus.REFUNDED, "999.99", "", "")
            assertNotNull(presenter.state.value.error)
            assertEquals(Money(2025, Currency.USD), store.returnsForOrder(order.id).single().refund)
        }
    }

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

    @Test fun recordsProviderTrackingEventsOnceAndRejectsAnotherOrdersShipment() = runBlocking {
        ShoppingStore.inMemory().use { store ->
            var id = 0
            val presenter = ShopPresenter(store, { "id-${++id}" }, { 100L }, Dispatchers.Unconfined)
            presenter.createOrder("Shop", listOf(DraftItem("Tablet", 1)))
            val order = presenter.state.value.selectedOrder!!
            presenter.attachShipment("ED852942182TH", "Thailand Post", listOf(order.items.single().id to 1), "thailandpost")
            val shipment = presenter.state.value.selectedOrder!!.shipments.single()
            assertEquals("thailandpost", shipment.carrierId)
            val event = CarrierEvent("event-1", ShipmentStatus.IN_TRANSIT, "อยู่ระหว่างการขนส่ง",
                1_563_534_746_000L, "19/07/2562 18:12:26+07:00", "+07:00")
            presenter.recordCarrierEvents(shipment.id, "thailandpost", listOf(event))
            val saved = presenter.state.value.events.getValue(shipment.id).single()
            assertEquals(ObservationMethod.PROVIDER, saved.method)
            assertEquals(1_563_534_746_000L, saved.occurredAtEpochMillis)
            presenter.recordCarrierEvents(shipment.id, "thailandpost", listOf(event))
            assertEquals(1, presenter.state.value.events.getValue(shipment.id).size)

            presenter.createOrder("Other", listOf(DraftItem("Phone", 1)))
            presenter.recordCarrierEvents(shipment.id, "thailandpost", listOf(event))
            assertTrue(presenter.state.value.error != null)
        }
    }

    @Test fun previewsAndImportsCsvOrdersWhileSkippingDuplicates() = runBlocking {
        ShoppingStore.inMemory().use { store ->
            var id = 0
            val presenter = ShopPresenter(store, { "id-${++id}" }, { 100L }, Dispatchers.Unconfined)
            presenter.createOrder("Shop", listOf(DraftItem("Existing", 1)), "M1")
            val csv = """
                merchant,order_id,currency,item_title,quantity,unit_price,total
                Shop,M1,THB,Existing,1,10.00,10.00
                Shop,M2,THB,Imported,2,20.00,40.00
            """.trimIndent().encodeToByteArray()
            val preview = presenter.previewOrderCsv(csv)
            assertTrue(preview.errors.isEmpty())
            assertEquals(1, preview.duplicates)
            assertEquals(1, preview.orders.size)
            assertEquals(1, presenter.importOrders(preview.orders))
            assertNotNull(store.findOrderByMerchantId("Shop", "M2"))
            val again = presenter.previewOrderCsv(csv)
            assertEquals(2, again.duplicates)
            assertTrue(again.orders.isEmpty())
            assertEquals(0, presenter.importOrders(again.orders))
        }
    }

    @Test fun updatesItemPricesAndOrderFinancialsTogether() = runBlocking {
        ShoppingStore.inMemory().use { store ->
            var id = 0
            val presenter = ShopPresenter(store, { "id-${++id}" }, { 100L }, Dispatchers.Unconfined)
            presenter.createOrder("Shop", listOf(DraftItem("Tablet", 2)), "M1")
            val order = presenter.state.value.selectedOrder!!
            presenter.updateOrderDetails(
                order.id,
                mapOf(order.items.single().id to "100.00"),
                shipping = "10.00", tax = "7.00", discount = "5.00", total = "212.00",
                merchantOrderId = "M1", purchasedAt = "2026-10-01", paymentLabel = "Visa",
            )
            assertNull(presenter.state.value.error)
            val updated = presenter.state.value.selectedOrder!!
            assertEquals(Money(20_000, Currency.THB), updated.itemSubtotal)
            assertEquals(Money(21_200, Currency.THB), updated.totalPaid)
            assertEquals("Visa", updated.paymentMethodLabel)
            assertTrue(updated.purchasedAtEpochMillis != null)
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
