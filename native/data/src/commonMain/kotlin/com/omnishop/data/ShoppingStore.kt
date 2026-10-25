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

    override fun close() = driver.close()

    private fun validatePage(limit: Int, offset: Int) {
        require(limit in 1..1000 && offset >= 0) { "Invalid page bounds" }
    }
}

data class OrderSummary(val id: String, val merchant: String, val createdAtEpochMillis: Long)

data class ShipmentLabel(val trackingNumber: String, val carrierLabel: String)
