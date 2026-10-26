package com.omnishop.data

import app.cash.sqldelight.db.SqlDriver
import com.omnishop.core.*
import com.omnishop.data.db.OmniShopDatabase

data class SavedProduct(val id: String, val title: String, val sourceUrl: String?, val savedAtEpochMillis: Long) {
    init { require(id.isNotBlank() && title.isNotBlank()) }
}

class ShoppingStore(private val driver: SqlDriver) : AutoCloseable {
    private val database = OmniShopDatabase(driver)
    private val queries = database.shoppingQueries

    companion object

    fun preference(key: String): String? = queries.findPreference(key).executeAsOneOrNull()

    fun setPreference(key: String, value: String) = queries.savePreference(key, value)

    fun shipmentLabel(id: String): ShipmentLabel? = queries.findShipment(id).executeAsOneOrNull()?.let {
        ShipmentLabel(it.tracking_number, it.carrier_label)
    }

    fun saveProduct(product: SavedProduct) {
        queries.saveProduct(product.id, product.title, product.sourceUrl, product.savedAtEpochMillis)
    }

    fun saveOffer(offer: Offer, observedAtEpochMillis: Long) {
        val estimate = offer.estimate
        val price = estimate.itemPrice
        database.transaction {
            queries.insertListing(offer.id, offer.productId, offer.sourceLabel, price.minorUnits,
                price.currency.code, price.currency.scale.toLong(),
                (estimate.shipping as? Cost.Known)?.amount?.minorUnits,
                (estimate.taxes as? Cost.Known)?.amount?.minorUnits,
                (estimate.fees as? Cost.Known)?.amount?.minorUnits, estimate.discount.minorUnits)
            queries.insertObservation(offer.id, observedAtEpochMillis, price.minorUnits, price.currency.code,
                price.currency.scale.toLong(), "manual")
        }
    }

    fun offersForProducts(productIds: List<String>): Map<String, List<Offer>> {
        if (productIds.isEmpty()) return emptyMap()
        return queries.offersForProducts(productIds).executeAsList().map { row ->
            val currency = Currency(row.currency_code, row.currency_scale.toInt())
            fun cost(amount: Long?): Cost = amount?.let { Cost.Known(Money(it, currency)) } ?: Cost.Unknown
            Offer(row.id, row.product_id, row.source_label, CostEstimate(Money(row.price_minor, currency),
                cost(row.shipping_minor), cost(row.taxes_minor), cost(row.fees_minor), Money(row.discount_minor, currency)))
        }.groupBy { it.productId }
    }

    fun listProducts(limit: Int = 100, offset: Int = 0): List<SavedProduct> {
        validatePage(limit, offset)
        return queries.listProducts(limit.toLong(), offset.toLong()).executeAsList().map {
            SavedProduct(it.id, it.title, it.source_url, it.saved_at)
        }
    }

    fun createOrder(order: PurchaseOrder, createdAtEpochMillis: Long) {
        require(order.shipments.isEmpty()) { "Attach shipments after creating the order" }
        database.transaction {
            queries.insertOrder(order.id, order.merchant, createdAtEpochMillis)
            order.items.forEach { queries.insertOrderItem(it.id, order.id, it.title, it.quantity.toLong()) }
        }
    }

    fun listOrders(limit: Int = 100, offset: Int = 0): List<OrderSummary> {
        validatePage(limit, offset)
        return queries.listOrders(limit.toLong(), offset.toLong()).executeAsList().map {
            OrderSummary(it.id, it.merchant, it.created_at)
        }
    }

    fun getOrder(id: String): PurchaseOrder? {
        val row = queries.findOrder(id).executeAsOneOrNull() ?: return null
        val items = queries.orderItems(id).executeAsList().map { OrderItem(it.id, it.title, it.quantity.toInt()) }
        val allocations = queries.orderAllocations(id).executeAsList().groupBy { it.shipment_id }
        val shipments = queries.orderShipments(id).executeAsList().map {
            Shipment(it.id, allocations[it.id].orEmpty().map { allocation ->
                ShipmentAllocation(allocation.order_item_id, allocation.quantity.toInt())
            }, ShipmentStatus.valueOf(it.status))
        }
        return PurchaseOrder(row.id, row.merchant, items, shipments)
    }

    fun attachShipment(orderId: String, shipment: Shipment, trackingNumber: String, carrierLabel: String) {
        require(trackingNumber.isNotBlank() && carrierLabel.isNotBlank())
        database.transaction {
            val order = requireNotNull(getOrder(orderId)) { "Order not found" }
            order.copy(shipments = order.shipments + shipment)
            queries.insertShipment(shipment.id, orderId, trackingNumber, carrierLabel, shipment.status.name)
            shipment.allocations.forEach {
                queries.insertAllocation(shipment.id, orderId, it.orderItemId, it.quantity.toLong())
            }
        }
    }

    fun recordEvent(event: TrackingEvent): Boolean = database.transactionWithResult {
        requireNotNull(queries.findShipment(event.shipmentId).executeAsOneOrNull()) { "Shipment not found" }
        if (queries.findEvent(event.shipmentId, event.source, event.sourceEventId).executeAsOneOrNull() != null) {
            return@transactionWithResult false
        }
        val latest = events(event.shipmentId).maxOfOrNull { it.occurredAtEpochMillis ?: it.importedAtEpochMillis }
        queries.insertEvent(
            event.shipmentId, event.source, event.sourceEventId, event.status.name, event.description,
            event.method.name, event.importedAtEpochMillis, event.occurredAtEpochMillis,
            event.originalTimestamp, event.originalTimezone,
        )
        // Preserve late-arriving history without rewinding the current status.
        if (latest == null || (event.occurredAtEpochMillis ?: event.importedAtEpochMillis) > latest) {
            queries.updateShipmentStatus(event.status.name, event.shipmentId)
        }
        true
    }

    fun events(shipmentId: String): List<TrackingEvent> = queries.shipmentEvents(shipmentId).executeAsList().map {
        TrackingEvent(it.shipment_id, it.source, it.source_event_id, ShipmentStatus.valueOf(it.status),
            it.description, ObservationMethod.valueOf(it.method), it.imported_at, it.occurred_at,
            it.original_timestamp, it.original_timezone)
    }

    fun upsertPrivate(row: PrivateRow) {
        queries.upsertPrivate(row.orderId, row.field, row.keyVersion.toLong(), row.nonce, row.ciphertext)
    }

    fun privateField(orderId: String, field: String): PrivateRow? =
        queries.findPrivate(orderId, field).executeAsOneOrNull()?.let {
            PrivateRow(it.order_id, it.field_, it.key_version.toInt(), it.nonce, it.ciphertext)
        }

    fun privateFields(): List<PrivateRow> = queries.allPrivate().executeAsList().map {
        PrivateRow(it.order_id, it.field_, it.key_version.toInt(), it.nonce, it.ciphertext)
    }

    fun deletePrivate(orderId: String, field: String) = queries.deletePrivate(orderId, field)

    fun snapshot(): BackupSnapshot = database.transactionWithResult {
        BackupSnapshot(
            products = queries.allProducts().executeAsList().map {
                BackupProduct(it.id, it.title, it.source_url, it.saved_at)
            },
            listings = queries.allListings().executeAsList().map {
                BackupListing(it.id, it.product_id, it.source_label, it.price_minor,
                    it.currency_code, it.currency_scale.toInt(), it.shipping_minor,
                    it.taxes_minor, it.fees_minor, it.discount_minor)
            },
            observations = queries.allObservations().executeAsList().map {
                BackupObservation(it.listing_id, it.observed_at, it.price_minor,
                    it.currency_code, it.currency_scale.toInt(), it.source)
            },
            orders = queries.allOrders().executeAsList().map {
                BackupOrder(it.id, it.merchant, it.created_at)
            },
            orderItems = queries.allOrderItems().executeAsList().map {
                BackupOrderItem(it.id, it.order_id, it.title, it.quantity.toInt())
            },
            shipments = queries.allShipments().executeAsList().map {
                BackupShipment(it.id, it.order_id, it.tracking_number, it.carrier_label, it.status)
            },
            allocations = queries.allAllocations().executeAsList().map {
                BackupAllocation(it.shipment_id, it.order_id, it.order_item_id, it.quantity.toInt())
            },
            events = queries.allEvents().executeAsList().map {
                BackupEvent(it.shipment_id, it.source, it.source_event_id, it.status,
                    it.description, it.method, it.imported_at, it.occurred_at,
                    it.original_timestamp, it.original_timezone)
            },
            preferences = queries.allPreferences().executeAsList().map {
                BackupPreference(it.key, it.value_)
            },
        )
    }

    fun replaceAll(snapshot: BackupSnapshot, privateRows: List<PrivateRow> = emptyList()): BackupCounts = database.transactionWithResult {
        // Child tables first; the whole replace is one transaction so a failed
        // insert rolls the old database back intact.
        queries.deleteEvents()
        queries.deleteAllPrivate()
        queries.deleteAllocations()
        queries.deleteShipments()
        queries.deleteOrderItems()
        queries.deleteOrders()
        queries.deleteObservations()
        queries.deleteListings()
        queries.deleteProducts()
        queries.deletePreferences()
        snapshot.products.forEach { queries.saveProduct(it.id, it.title, it.sourceUrl, it.savedAt) }
        snapshot.listings.forEach {
            queries.insertListing(it.id, it.productId, it.sourceLabel, it.priceMinor, it.currencyCode,
                it.currencyScale.toLong(), it.shippingMinor, it.taxesMinor, it.feesMinor, it.discountMinor)
        }
        snapshot.observations.forEach {
            queries.insertObservation(it.listingId, it.observedAt, it.priceMinor, it.currencyCode,
                it.currencyScale.toLong(), it.source)
        }
        snapshot.orders.forEach { queries.insertOrder(it.id, it.merchant, it.createdAt) }
        privateRows.forEach(::upsertPrivate)
        snapshot.orderItems.forEach { queries.insertOrderItem(it.id, it.orderId, it.title, it.quantity.toLong()) }
        snapshot.shipments.forEach {
            queries.insertShipment(it.id, it.orderId, it.trackingNumber, it.carrierLabel, it.status)
        }
        snapshot.allocations.forEach {
            queries.insertAllocation(it.shipmentId, it.orderId, it.orderItemId, it.quantity.toLong())
        }
        snapshot.events.forEach {
            queries.insertEventStrict(it.shipmentId, it.source, it.sourceEventId, it.status,
                it.description, it.method, it.importedAt, it.occurredAt,
                it.originalTimestamp, it.originalTimezone)
        }
        snapshot.preferences.forEach { queries.savePreference(it.key, it.value) }
        BackupCounts(snapshot.products.size, snapshot.listings.size, snapshot.orders.size,
            snapshot.shipments.size, snapshot.events.size)
    }

    override fun close() = driver.close()

    private fun validatePage(limit: Int, offset: Int) {
        require(limit in 1..1000 && offset >= 0) { "Invalid page bounds" }
    }
}

data class OrderSummary(val id: String, val merchant: String, val createdAtEpochMillis: Long)

data class ShipmentLabel(val trackingNumber: String, val carrierLabel: String)
