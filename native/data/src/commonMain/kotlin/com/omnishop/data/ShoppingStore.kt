package com.omnishop.data

import app.cash.sqldelight.db.SqlDriver
import com.omnishop.core.*
import com.omnishop.data.db.OmniShopDatabase

data class SavedProduct(val id: String, val title: String, val sourceUrl: String?, val savedAtEpochMillis: Long) {
    init { require(id.isNotBlank() && title.isNotBlank()) }
}

class ShoppingStore(
    private val driver: SqlDriver,
    private val originDevice: String = "local",
    private val clock: () -> Long = { kotlin.time.Clock.System.now().toEpochMilliseconds() },
) : AutoCloseable {
    private val database = OmniShopDatabase(driver)
    private val queries = database.shoppingQueries

    companion object

    fun preference(key: String): String? = queries.findPreference(key).executeAsOneOrNull()

    fun setPreference(key: String, value: String) {
        database.transaction {
            queries.savePreference(key, value)
            recordSyncMeta("settings", key, null)
        }
    }

    fun deletePreference(key: String) {
        database.transaction {
            queries.deletePreference(key)
            recordSyncMeta("settings", key, clock())
        }
    }

    fun shipmentLabel(id: String): ShipmentLabel? = queries.findShipment(id).executeAsOneOrNull()?.let {
        ShipmentLabel(it.tracking_number, it.carrier_label)
    }

    fun saveProduct(product: SavedProduct) {
        database.transaction {
            queries.saveProduct(product.id, product.title, product.sourceUrl, product.savedAtEpochMillis)
            recordSyncMeta("watchlist", product.id, null)
        }
    }

    fun deleteProduct(id: String) {
        database.transaction {
            queries.deleteProduct(id)
            recordSyncMeta("watchlist", id, clock())
        }
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
            recordSyncMeta("watchlist", offer.productId, null)
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
        createOrders(listOf(order), createdAtEpochMillis)
    }

    fun createOrders(orders: List<PurchaseOrder>, createdAtEpochMillis: Long) {
        require(orders.all { it.shipments.isEmpty() }) { "Attach shipments after creating orders" }
        database.transaction {
            orders.forEach { order ->
                queries.insertOrder(
                    order.id, order.merchant, createdAtEpochMillis,
                    order.currency?.code, order.currency?.scale?.toLong(),
                    order.shipping?.minorUnits, order.tax?.minorUnits, order.discount?.minorUnits,
                    order.totalPaid?.minorUnits, order.merchantOrderId,
                    order.purchasedAtEpochMillis, order.paymentMethodLabel,
                )
                order.items.forEach {
                    queries.insertOrderItem(it.id, order.id, it.title, it.quantity.toLong(), it.unitPrice?.minorUnits)
                }
                recordSyncMeta("orders", order.id, null)
            }
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
        val currency = row.currency_code?.let { code -> row.currency_scale?.let { Currency(code, it.toInt()) } }
        fun money(minor: Long?): Money? = if (minor != null && currency != null) Money(minor, currency) else null
        val items = queries.orderItems(id).executeAsList().map {
            OrderItem(it.id, it.title, it.quantity.toInt(), it.unit_price_minor?.let { price -> currency?.let { c -> Money(price, c) } })
        }
        val allocations = queries.orderAllocations(id).executeAsList().groupBy { it.shipment_id }
        val shipments = queries.orderShipments(id).executeAsList().map {
            Shipment(it.id, allocations[it.id].orEmpty().map { allocation ->
                ShipmentAllocation(allocation.order_item_id, allocation.quantity.toInt())
            }, ShipmentStatus.valueOf(it.status), it.carrier_id)
        }
        return PurchaseOrder(
            row.id, row.merchant, items, shipments, currency,
            money(row.shipping_minor), money(row.tax_minor), money(row.discount_minor), money(row.total_minor),
            row.merchant_order_id, row.purchased_at, row.payment_method_label,
        )
    }

    fun findOrderByMerchantId(merchant: String, merchantOrderId: String): PurchaseOrder? =
        queries.findOrderByMerchantId(merchant, merchantOrderId).executeAsOneOrNull()?.let { getOrder(it.id) }

    fun updateOrderFinancials(
        orderId: String,
        currency: Currency?,
        shipping: Money?,
        tax: Money?,
        discount: Money?,
        totalPaid: Money?,
        merchantOrderId: String?,
        purchasedAtEpochMillis: Long?,
        paymentMethodLabel: String?,
    ) {
        database.transaction {
            val current = requireNotNull(getOrder(orderId)) { "Order not found" }
            val updated = current.copy(
                currency = currency, shipping = shipping, tax = tax, discount = discount,
                totalPaid = totalPaid, merchantOrderId = merchantOrderId,
                purchasedAtEpochMillis = purchasedAtEpochMillis, paymentMethodLabel = paymentMethodLabel,
            )
            queries.updateOrderFinancials(
                updated.currency?.code, updated.currency?.scale?.toLong(),
                updated.shipping?.minorUnits, updated.tax?.minorUnits, updated.discount?.minorUnits,
                updated.totalPaid?.minorUnits, updated.merchantOrderId,
                updated.purchasedAtEpochMillis, updated.paymentMethodLabel, orderId,
            )
            recordSyncMeta("orders", orderId, null)
        }
    }

    fun updateOrder(updated: PurchaseOrder) {
        database.transaction {
            val current = requireNotNull(getOrder(updated.id)) { "Order not found" }
            require(current.items.map { it.id }.toSet() == updated.items.map { it.id }.toSet()) {
                "Order items cannot be replaced by a financial update"
            }
            queries.updateOrderFinancials(
                updated.currency?.code, updated.currency?.scale?.toLong(),
                updated.shipping?.minorUnits, updated.tax?.minorUnits, updated.discount?.minorUnits,
                updated.totalPaid?.minorUnits, updated.merchantOrderId,
                updated.purchasedAtEpochMillis, updated.paymentMethodLabel, updated.id,
            )
            updated.items.forEach { queries.updateOrderItemPrice(it.unitPrice?.minorUnits, it.id) }
            recordSyncMeta("orders", updated.id, null)
        }
    }

    fun updateOrderItemPrice(orderId: String, itemId: String, unitPrice: Money?) {
        database.transaction {
            val current = requireNotNull(getOrder(orderId)) { "Order not found" }
            require(current.items.any { it.id == itemId }) { "Order item not found" }
            current.copy(items = current.items.map { if (it.id == itemId) it.copy(unitPrice = unitPrice) else it })
            queries.updateOrderItemPrice(unitPrice?.minorUnits, itemId)
            recordSyncMeta("orders", orderId, null)
        }
    }

    fun attachShipment(orderId: String, shipment: Shipment, trackingNumber: String, carrierLabel: String, carrierId: String? = null) {
        require(trackingNumber.isNotBlank() && carrierLabel.isNotBlank())
        database.transaction {
            val order = requireNotNull(getOrder(orderId)) { "Order not found" }
            order.copy(shipments = order.shipments + shipment)
            queries.insertShipment(shipment.id, orderId, trackingNumber, carrierLabel, shipment.status.name, carrierId)
            shipment.allocations.forEach {
                queries.insertAllocation(shipment.id, orderId, it.orderItemId, it.quantity.toLong())
            }
            recordSyncMeta("orders", orderId, null)
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
        val orderId = requireNotNull(queries.findShipment(event.shipmentId).executeAsOneOrNull()).order_id
        recordSyncMeta("orders", orderId, null)
        true
    }

    fun events(shipmentId: String): List<TrackingEvent> = queries.shipmentEvents(shipmentId).executeAsList().map {
        TrackingEvent(it.shipment_id, it.source, it.source_event_id, ShipmentStatus.valueOf(it.status),
            it.description, ObservationMethod.valueOf(it.method), it.imported_at, it.occurred_at,
            it.original_timestamp, it.original_timezone)
    }

    fun createReturn(record: ReturnRecord) {
        database.transaction {
            val order = requireNotNull(getOrder(record.orderId)) { "Order not found" }
            validateOrderReturns(order, returnsForOrder(record.orderId) + record)
            queries.insertReturn(record.id, record.orderId, record.orderItemId, record.quantity.toLong(),
                record.reason, record.status.name, record.requestedAtEpochMillis,
                record.returnTrackingNumber, record.refund?.minorUnits,
                record.refund?.currency?.code, record.refund?.currency?.scale?.toLong(), record.notes)
            recordSyncMeta("orders", record.orderId, null)
        }
    }

    fun returnsForOrder(orderId: String): List<ReturnRecord> =
        queries.returnsForOrder(orderId).executeAsList().map { it.toReturn() }

    fun updateReturn(id: String, status: ReturnStatus, refund: Money?, tracking: String?, notes: String?) {
        database.transaction {
            val existing = requireNotNull(queries.findReturn(id).executeAsOneOrNull()) { "Return not found" }.toReturn()
            val updated = existing.copy(status = status, refund = refund, returnTrackingNumber = tracking, notes = notes)
            val order = requireNotNull(getOrder(existing.orderId)) { "Order not found" }
            validateOrderReturns(order, returnsForOrder(order.id).map { if (it.id == id) updated else it })
            queries.updateReturn(updated.status.name, updated.returnTrackingNumber, updated.refund?.minorUnits,
                updated.refund?.currency?.code, updated.refund?.currency?.scale?.toLong(), updated.notes, id)
            recordSyncMeta("orders", order.id, null)
        }
    }

    fun deleteOrder(id: String) {
        database.transaction {
            queries.deleteOrder(id)
            recordSyncMeta("orders", id, clock())
        }
    }

    fun orderPayload(id: String): String? {
        val row = queries.findOrder(id).executeAsOneOrNull() ?: return null
        val order = getOrder(id) ?: return null
        val shipments = order.shipments.map { shipment ->
            val label = shipmentLabel(shipment.id) ?: return null
            SyncShipment(shipment.id, id, label.trackingNumber, label.carrierLabel, shipment.status.name, shipment.carrierId)
        }
        val allocations = order.shipments.flatMap { shipment ->
            shipment.allocations.map { SyncAllocation(shipment.id, id, it.orderItemId, it.quantity) }
        }
        val events = order.shipments.flatMap { shipment ->
            events(shipment.id).map {
                SyncEvent(shipment.id, it.source, it.sourceEventId, it.status.name, it.description,
                    it.method.name, it.importedAtEpochMillis, it.occurredAtEpochMillis,
                    it.originalTimestamp, it.originalTimezone)
            }
        }
        val returns = returnsForOrder(id).map {
            SyncReturn(it.id, id, it.orderItemId, it.quantity, it.reason, it.status.name,
                it.requestedAtEpochMillis, it.returnTrackingNumber, it.refund?.minorUnits,
                it.refund?.currency?.code, it.refund?.currency?.scale, it.notes)
        }
        val payload = OrderPayload(
            SyncOrder(order.id, order.merchant, row.created_at, order.currency?.code, order.currency?.scale,
                order.shipping?.minorUnits, order.tax?.minorUnits, order.discount?.minorUnits,
                order.totalPaid?.minorUnits, order.merchantOrderId, order.purchasedAtEpochMillis,
                order.paymentMethodLabel),
            order.items.map {
                SyncOrderItem(it.id, id, it.title, it.quantity, it.unitPrice?.minorUnits)
            },
            shipments, allocations, events, returns,
        )
        return SyncJson.json.encodeToString(OrderPayload.serializer(), payload)
    }

    fun applyOrderSync(change: SyncChange) {
        require(change.collection == "orders")
        if (change.deletedAt != null) {
            database.transaction {
                queries.deleteOrder(change.id)
                queries.upsertSyncMeta(change.collection, change.id, change.updatedAt, change.originDevice, change.deletedAt)
            }
            return
        }
        val payload = SyncJson.json.decodeFromString(
            OrderPayload.serializer(),
            requireNotNull(change.payload) { "Missing order payload" },
        )
        require(payload.order.id == change.id) { "Order payload id mismatch" }
        require(payload.order.createdAt >= 0) { "Invalid order timestamp" }
        val currency = payload.order.currencyCode?.let { code ->
            Currency(code, requireNotNull(payload.order.currencyScale) { "Missing order currency scale" })
        }
        fun money(minor: Long?): Money? = if (minor != null && currency != null) Money(minor, currency) else null
        if (currency == null && (
                payload.items.any { it.unitPriceMinor != null } ||
                    listOfNotNull(payload.order.shippingMinor, payload.order.taxMinor,
                        payload.order.discountMinor, payload.order.totalMinor).isNotEmpty()
                )) {
            error("Order money requires a currency")
        }
        val items = payload.items.map {
            require(it.orderId == payload.order.id) { "Order item belongs to another order" }
            OrderItem(it.id, it.title, it.quantity, money(it.unitPriceMinor))
        }
        require(payload.allocations.all { allocation ->
            payload.shipments.any { it.id == allocation.shipmentId }
        }) { "Allocation belongs to an unknown shipment" }
        val shipments = payload.shipments.map { shipment ->
            require(shipment.orderId == payload.order.id) { "Shipment belongs to another order" }
            require(shipment.trackingNumber.isNotBlank() && shipment.carrierLabel.isNotBlank()) {
                "Shipment tracking and carrier are required"
            }
            val allocations = payload.allocations.filter { it.shipmentId == shipment.id }
            require(allocations.all { it.orderId == payload.order.id }) { "Allocation belongs to another order" }
            Shipment(shipment.id, allocations.map { ShipmentAllocation(it.orderItemId, it.quantity) },
                ShipmentStatus.valueOf(shipment.status), shipment.carrierId)
        }
        val order = PurchaseOrder(
            payload.order.id, payload.order.merchant, items, shipments, currency,
            money(payload.order.shippingMinor), money(payload.order.taxMinor), money(payload.order.discountMinor),
            money(payload.order.totalMinor), payload.order.merchantOrderId, payload.order.purchasedAt,
            payload.order.paymentMethodLabel,
        )
        val returns = payload.returns.map {
            require(it.orderId == payload.order.id) { "Return belongs to another order" }
            val refundCurrency = it.currencyCode?.let { code ->
                Currency(code, requireNotNull(it.currencyScale) { "Missing refund currency scale" })
            }
            ReturnRecord(it.id, it.orderId, it.orderItemId, it.quantity, it.reason,
                ReturnStatus.valueOf(it.status), it.requestedAt, it.returnTracking,
                it.refundMinor?.let { amount -> Money(amount, requireNotNull(refundCurrency)) }, it.notes)
        }
        validateOrderReturns(order, returns)
        val events = payload.events.map {
            require(shipments.any { shipment -> shipment.id == it.shipmentId }) { "Event belongs to another order" }
            TrackingEvent(it.shipmentId, it.source, it.sourceEventId, ShipmentStatus.valueOf(it.status),
                it.description, ObservationMethod.valueOf(it.method), it.importedAt, it.occurredAt,
                it.originalTimestamp, it.originalTimezone)
        }
        require(events.map { Triple(it.shipmentId, it.source, it.sourceEventId) }.distinct().size == events.size) {
            "Duplicate tracking event"
        }
        database.transaction {
            if (getOrder(order.id) != null) {
                queries.deleteReturnsForOrder(order.id)
                queries.deleteShipmentsForOrder(order.id)
                queries.deleteOrderItemsForOrder(order.id)
                queries.updateOrderFinancials(
                    order.currency?.code, order.currency?.scale?.toLong(),
                    order.shipping?.minorUnits, order.tax?.minorUnits, order.discount?.minorUnits,
                    order.totalPaid?.minorUnits, order.merchantOrderId,
                    order.purchasedAtEpochMillis, order.paymentMethodLabel, order.id,
                )
            } else {
                queries.insertOrder(order.id, order.merchant, payload.order.createdAt,
                    order.currency?.code, order.currency?.scale?.toLong(),
                    order.shipping?.minorUnits, order.tax?.minorUnits, order.discount?.minorUnits,
                    order.totalPaid?.minorUnits, order.merchantOrderId,
                    order.purchasedAtEpochMillis, order.paymentMethodLabel)
            }
            items.forEach {
                queries.insertOrderItem(it.id, order.id, it.title, it.quantity.toLong(), it.unitPrice?.minorUnits)
            }
            shipments.forEach {
                queries.insertShipment(it.id, order.id, payload.shipments.first { s -> s.id == it.id }.trackingNumber,
                    payload.shipments.first { s -> s.id == it.id }.carrierLabel, it.status.name, it.carrierId)
            }
            payload.allocations.forEach {
                queries.insertAllocation(it.shipmentId, order.id, it.orderItemId, it.quantity.toLong())
            }
            events.forEach {
                queries.insertEventStrict(it.shipmentId, it.source, it.sourceEventId, it.status.name,
                    it.description, it.method.name, it.importedAtEpochMillis, it.occurredAtEpochMillis,
                    it.originalTimestamp, it.originalTimezone)
            }
            returns.forEach {
                queries.insertReturn(it.id, it.orderId, it.orderItemId, it.quantity.toLong(), it.reason,
                    it.status.name, it.requestedAtEpochMillis, it.returnTrackingNumber,
                    it.refund?.minorUnits, it.refund?.currency?.code, it.refund?.currency?.scale?.toLong(), it.notes)
            }
            queries.upsertSyncMeta(change.collection, change.id, change.updatedAt, change.originDevice, change.deletedAt)
        }
    }

    private fun com.omnishop.data.db.Order_return.toReturn(): ReturnRecord {
        val currency = currency_code?.let { code -> currency_scale?.let { Currency(code, it.toInt()) } }
        return ReturnRecord(
            id, order_id, order_item_id, quantity.toInt(), reason,
            ReturnStatus.valueOf(status), requested_at,
            return_tracking, refund_minor?.let { amount -> requireNotNull(currency).let { Money(amount, it) } }, notes,
        )
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

    fun watchlistPayload(id: String): String? {
        val product = queries.findProduct(id).executeAsOneOrNull() ?: return null
        val listings = queries.listingsForProduct(id).executeAsList()
        val observations = listings.flatMap { listing ->
            queries.observationsForListing(listing.id).executeAsList()
        }
        return SyncJson.json.encodeToString(
            WatchlistPayload.serializer(),
            WatchlistPayload(
                SyncProduct(product.id, product.title, product.source_url, product.saved_at),
                listings.map {
                    SyncListing(it.id, it.product_id, it.source_label, it.price_minor,
                        it.currency_code, it.currency_scale.toInt(), it.shipping_minor,
                        it.taxes_minor, it.fees_minor, it.discount_minor)
                },
                observations.map {
                    SyncObservation(it.listing_id, it.observed_at, it.price_minor,
                        it.currency_code, it.currency_scale.toInt(), it.source)
                },
            ),
        )
    }

    fun applySettingSync(change: SyncChange) {
        require(change.collection == "settings")
        database.transaction {
            if (change.deletedAt != null) {
                queries.deletePreference(change.id)
            } else {
                queries.savePreference(change.id, requireNotNull(change.payload) { "Missing setting value" })
            }
            queries.upsertSyncMeta(change.collection, change.id, change.updatedAt, change.originDevice, change.deletedAt)
        }
    }

    fun applyWatchlistSync(change: SyncChange) {
        require(change.collection == "watchlist")
        database.transaction {
            if (change.deletedAt != null) {
                queries.deleteProduct(change.id)
            } else {
                val payload = SyncJson.json.decodeFromString(
                    WatchlistPayload.serializer(),
                    requireNotNull(change.payload) { "Missing watchlist payload" },
                )
                require(payload.product.id == change.id) { "Watchlist payload id mismatch" }
                require(payload.listings.all { it.productId == change.id }) { "Listing belongs to another product" }
                val listingIds = payload.listings.map { it.id }.toSet()
                require(payload.observations.all { it.listingId in listingIds }) { "Observation belongs to another listing" }
                payload.listings.forEach {
                    require(it.priceMinor >= 0 && it.discountMinor >= 0) { "Invalid listing money" }
                    require((it.shippingMinor ?: 0) >= 0 && (it.taxesMinor ?: 0) >= 0 && (it.feesMinor ?: 0) >= 0) {
                        "Invalid listing cost"
                    }
                    Currency(it.currencyCode, it.currencyScale)
                }
                payload.observations.forEach {
                    require(it.priceMinor >= 0) { "Invalid observation money" }
                    Currency(it.currencyCode, it.currencyScale)
                }
                queries.deleteProduct(change.id)
                queries.saveProduct(payload.product.id, payload.product.title, payload.product.sourceUrl, payload.product.savedAt)
                payload.listings.forEach {
                    queries.insertListing(it.id, it.productId, it.sourceLabel, it.priceMinor,
                        it.currencyCode, it.currencyScale.toLong(), it.shippingMinor,
                        it.taxesMinor, it.feesMinor, it.discountMinor)
                }
                payload.observations.forEach {
                    queries.insertObservation(it.listingId, it.observedAt, it.priceMinor,
                        it.currencyCode, it.currencyScale.toLong(), it.source)
                }
            }
            queries.upsertSyncMeta(change.collection, change.id, change.updatedAt, change.originDevice, change.deletedAt)
        }
    }

    fun applySyncMeta(collection: String, id: String, updatedAt: Long, originDevice: String, deletedAt: Long?) {
        queries.upsertSyncMeta(collection, id, updatedAt, originDevice, deletedAt)
    }

    fun recordSyncMeta(collection: String, id: String, deletedAt: Long?) {
        queries.upsertSyncMeta(collection, id, clock(), originDevice, deletedAt)
    }

    fun syncMeta(collection: String, id: String): SyncMeta? =
        queries.findSyncMeta(collection, id).executeAsOneOrNull()?.let {
            SyncMeta(it.collection, it.id, it.updated_at, it.origin_device, it.deleted_at)
        }

    fun syncChanges(
        cursor: SyncCursor,
        collections: Set<String>,
        limit: Int,
    ): List<SyncMeta> {
        if (collections.isEmpty()) return emptyList()
        require(limit in 1..1000)
        return queries.syncChanges(
            collections.toList(), cursor.updatedAt, cursor.originDevice, cursor.id, limit.toLong(),
        ).executeAsList().map {
            SyncMeta(it.collection, it.id, it.updated_at, it.origin_device, it.deleted_at)
        }
    }

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
                BackupOrder(it.id, it.merchant, it.created_at, it.currency_code, it.currency_scale?.toInt(),
                    it.shipping_minor, it.tax_minor, it.discount_minor, it.total_minor,
                    it.merchant_order_id, it.purchased_at, it.payment_method_label)
            },
            orderItems = queries.allOrderItems().executeAsList().map {
                BackupOrderItem(it.id, it.order_id, it.title, it.quantity.toInt(), it.unit_price_minor)
            },
            shipments = queries.allShipments().executeAsList().map {
                BackupShipment(it.id, it.order_id, it.tracking_number, it.carrier_label, it.status, it.carrier_id)
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
            returns = queries.allReturns().executeAsList().map {
                BackupReturn(it.id, it.order_id, it.order_item_id, it.quantity.toInt(), it.reason,
                    it.status, it.requested_at, it.return_tracking, it.refund_minor,
                    it.currency_code, it.currency_scale?.toInt(), it.notes)
            },
        )
    }

    fun replaceAll(snapshot: BackupSnapshot, privateRows: List<PrivateRow> = emptyList()): BackupCounts = database.transactionWithResult {
        // Child tables first; the whole replace is one transaction so a failed
        // insert rolls the old database back intact.
        queries.deleteEvents()
        queries.deleteAllReturns()
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
        snapshot.orders.forEach {
            queries.insertOrder(it.id, it.merchant, it.createdAt, it.currencyCode, it.currencyScale?.toLong(),
                it.shippingMinor, it.taxMinor, it.discountMinor, it.totalMinor,
                it.merchantOrderId, it.purchasedAt, it.paymentMethodLabel)
        }
        privateRows.forEach(::upsertPrivate)
        snapshot.orderItems.forEach {
            queries.insertOrderItem(it.id, it.orderId, it.title, it.quantity.toLong(), it.unitPriceMinor)
        }
        snapshot.returns.forEach {
            queries.insertReturn(it.id, it.orderId, it.orderItemId, it.quantity.toLong(), it.reason,
                it.status, it.requestedAt, it.returnTracking, it.refundMinor,
                it.currencyCode, it.currencyScale?.toLong(), it.notes)
        }
        snapshot.shipments.forEach {
            queries.insertShipment(it.id, it.orderId, it.trackingNumber, it.carrierLabel, it.status, it.carrierId)
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
            snapshot.shipments.size, snapshot.events.size, snapshot.returns.size)
    }

    override fun close() = driver.close()

    private fun validatePage(limit: Int, offset: Int) {
        require(limit in 1..1000 && offset >= 0) { "Invalid page bounds" }
    }
}

data class OrderSummary(val id: String, val merchant: String, val createdAtEpochMillis: Long)

data class ShipmentLabel(val trackingNumber: String, val carrierLabel: String)
