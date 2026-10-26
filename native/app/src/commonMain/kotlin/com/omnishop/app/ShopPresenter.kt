package com.omnishop.app

import com.omnishop.core.*
import com.omnishop.carriers.CarrierEvent
import com.omnishop.connectors.validatedBookmarkUrl
import com.omnishop.data.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlin.time.Instant

data class DraftItem(val title: String, val quantity: Int, val unitPrice: String = "")

data class OrderImportPreview(
    val orders: List<PurchaseOrder>,
    val errors: List<String>,
    val duplicates: Int,
)

data class ShopSnapshot(
    val products: List<SavedProduct> = emptyList(),
    val offers: Map<String, List<Offer>> = emptyMap(),
    val orders: List<OrderSummary> = emptyList(),
    val selectedOrder: PurchaseOrder? = null,
    val events: Map<String, List<TrackingEvent>> = emptyMap(),
    val shipmentLabels: Map<String, ShipmentLabel> = emptyMap(),
    val returns: List<ReturnRecord> = emptyList(),
    val language: AppLanguage = AppLanguage.ENGLISH,
    val busy: Boolean = false,
    val error: String? = null,
)

class ShopPresenter(
    private val store: ShoppingStore,
    private val newId: () -> String,
    private val now: () -> Long,
    private val dispatcher: CoroutineDispatcher = Dispatchers.Default,
) {
    private val mutex = Mutex()
    private val mutableState = MutableStateFlow(ShopSnapshot())
    val state = mutableState.asStateFlow()
    private var selectedOrderId: String? = null

    suspend fun refresh() = perform { }

    suspend fun saveProduct(title: String, url: String) = perform {
        val link = url.trim().takeIf { it.isNotEmpty() }?.let(::validatedBookmarkUrl)
        store.saveProduct(SavedProduct(newId(), title.trim(), link, now()))
    }

    suspend fun createOrder(
        merchant: String,
        items: List<DraftItem>,
        merchantOrderId: String? = null,
    ) = perform {
        require(merchant.isNotBlank()) { "Enter a merchant" }
        require(items.isNotEmpty() && items.all { it.title.isNotBlank() && it.quantity > 0 }) {
            "Every item needs a title and a positive quantity"
        }
        val currency = Currency.THB
        val orderItems = items.map {
            val price = it.unitPrice.trim().takeIf { value -> value.isNotEmpty() }
                ?.let { value -> parseNonNegativeMoney(value, currency) }
            OrderItem(newId(), it.title.trim(), it.quantity, price)
        }
        val orderId = newId()
        store.createOrder(
            PurchaseOrder(
                orderId, merchant.trim(), orderItems,
                currency = if (orderItems.any { it.unitPrice != null }) currency else null,
                merchantOrderId = merchantOrderId?.trim()?.takeIf { it.isNotEmpty() },
            ),
            now(),
        )
        selectedOrderId = orderId
    }

    suspend fun updateOrderItemPrice(orderId: String, itemId: String, price: String) = perform {
        val order = requireNotNull(store.getOrder(orderId)) { "Order not found" }
        val currency = order.currency ?: Currency.THB
        val amount = price.trim().takeIf { it.isNotEmpty() }?.let { parseNonNegativeMoney(it, currency) }
        store.updateOrderItemPrice(orderId, itemId, amount)
    }

    suspend fun updateOrderDetails(
        orderId: String,
        itemPrices: Map<String, String>,
        shipping: String,
        tax: String,
        discount: String,
        total: String,
        merchantOrderId: String,
        purchasedAt: String,
        paymentLabel: String,
    ) = perform {
        val order = requireNotNull(store.getOrder(orderId)) { "Order not found" }
        val currency = order.currency ?: Currency.THB
        fun amount(value: String): Money? =
            value.trim().takeIf { it.isNotEmpty() }?.let { parseNonNegativeMoney(it, currency) }
        val purchased = purchasedAt.trim().takeIf { it.isNotEmpty() }?.let {
            require(Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(it)) { "Purchase date must be YYYY-MM-DD" }
            Instant.parse("${it}T00:00:00Z").toEpochMilliseconds()
        }
        val items = order.items.map { item ->
            val raw = itemPrices[item.id] ?: return@map item
            item.copy(unitPrice = raw.trim().takeIf { it.isNotEmpty() }?.let { parseNonNegativeMoney(it, currency) })
        }
        val hasMoney = listOf(shipping, tax, discount, total).any { it.isNotBlank() } || items.any { it.unitPrice != null }
        store.updateOrder(order.copy(
            items = items,
            currency = if (hasMoney) currency else order.currency,
            shipping = amount(shipping), tax = amount(tax), discount = amount(discount), totalPaid = amount(total),
            merchantOrderId = merchantOrderId.trim().takeIf { it.isNotEmpty() },
            purchasedAtEpochMillis = purchased,
            paymentMethodLabel = paymentLabel.trim().takeIf { it.isNotEmpty() },
        ))
    }

    suspend fun updateOrderFinancials(
        orderId: String,
        shipping: String,
        tax: String,
        discount: String,
        total: String,
        merchantOrderId: String,
        purchasedAt: String,
        paymentLabel: String,
    ) = perform {
        val order = requireNotNull(store.getOrder(orderId)) { "Order not found" }
        val currency = order.currency ?: Currency.THB
        fun amount(value: String): Money? =
            value.trim().takeIf { it.isNotEmpty() }?.let { parseNonNegativeMoney(it, currency) }
        val purchased = purchasedAt.trim().takeIf { it.isNotEmpty() }?.let {
            require(Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(it)) { "Purchase date must be YYYY-MM-DD" }
            Instant.parse("${it}T00:00:00Z").toEpochMilliseconds()
        }
        val hasMoney = listOf(shipping, tax, discount, total).any { it.isNotBlank() }
        store.updateOrderFinancials(
            orderId,
            if (hasMoney) currency else order.currency,
            amount(shipping), amount(tax), amount(discount), amount(total),
            merchantOrderId.trim().takeIf { it.isNotEmpty() },
            purchased,
            paymentLabel.trim().takeIf { it.isNotEmpty() },
        )
    }

    suspend fun addOffer(productId: String, source: String, amount: String, shipping: String) = perform {
        val price = parseNonNegativeMoney(amount.trim(), Currency.THB)
        val shippingCost = shipping.trim().takeIf { it.isNotEmpty() }
            ?.let { Cost.Known(parseNonNegativeMoney(it, Currency.THB)) } ?: Cost.Unknown
        store.saveOffer(Offer(newId(), productId, source.trim(), CostEstimate(price, shipping = shippingCost)), now())
    }

    suspend fun selectOrder(id: String?) = perform { selectedOrderId = id }

    suspend fun attachShipment(
        tracking: String,
        carrier: String,
        allocations: List<Pair<String, Int>>,
        carrierId: String? = null,
    ) = perform {
        val order = requireNotNull(selectedOrderId?.let(store::getOrder)) { "Select an order first" }
        val positive = allocations.filter { it.second > 0 }
        require(positive.isNotEmpty()) { "Allocate at least one unit to this package" }
        store.attachShipment(
            order.id,
            Shipment(newId(), positive.map { ShipmentAllocation(it.first, it.second) }, carrierId = carrierId),
            tracking.trim(),
            carrier.trim(),
            carrierId,
        )
    }

    suspend fun recordCarrierEvents(shipmentId: String, carrierId: String, events: List<CarrierEvent>) = perform {
        val order = requireNotNull(selectedOrderId?.let(store::getOrder)) { "Select an order first" }
        require(order.shipments.any { it.id == shipmentId }) { "Shipment does not belong to this order" }
        events.sortedBy { it.occurredAtEpochMillis ?: Long.MAX_VALUE }.forEach {
            store.recordEvent(TrackingEvent(
                shipmentId, carrierId, it.sourceEventId, it.status, it.description,
                ObservationMethod.PROVIDER, now(), it.occurredAtEpochMillis,
                it.originalTimestamp, it.originalTimezone,
            ))
        }
    }

    suspend fun recordManualEvent(shipmentId: String, status: ShipmentStatus, description: String) = perform {
        store.recordEvent(TrackingEvent(shipmentId, "manual", newId(), status, description.trim(), ObservationMethod.MANUAL, now()))
    }

    suspend fun changeLanguage(language: AppLanguage) = perform { store.setPreference("language", language.name) }

    suspend fun previewOrderCsv(bytes: ByteArray): OrderImportPreview = withContext(dispatcher) {
        val parsed = OrderCsvImporter(newId).parse(bytes)
        val duplicates = parsed.orders.count {
            it.merchantOrderId?.let { id -> store.findOrderByMerchantId(it.merchant, id) } != null
        }
        OrderImportPreview(
            orders = parsed.orders.filter {
                it.merchantOrderId?.let { id -> store.findOrderByMerchantId(it.merchant, id) } == null
            },
            errors = parsed.errors,
            duplicates = duplicates,
        )
    }

    suspend fun importOrders(orders: List<PurchaseOrder>): Int {
        var imported = 0
        perform {
            val fresh = orders.filter {
                it.merchantOrderId?.let { id -> store.findOrderByMerchantId(it.merchant, id) } == null
            }
            store.createOrders(fresh, now())
            imported = fresh.size
        }
        return if (state.value.error == null) imported else 0
    }

    suspend fun createReturn(orderItemId: String, quantity: Int, reason: String) = perform {
        val order = requireNotNull(selectedOrderId?.let(store::getOrder)) { "Select an order first" }
        store.createReturn(ReturnRecord(newId(), order.id, orderItemId, quantity, reason.trim(), ReturnStatus.REQUESTED, now()))
    }

    suspend fun updateReturn(returnId: String, status: ReturnStatus, refundAmount: String, tracking: String, notes: String) = perform {
        val orderId = requireNotNull(selectedOrderId) { "Select an order first" }
        val record = requireNotNull(store.returnsForOrder(orderId).firstOrNull { it.id == returnId }) { "Return does not belong to this order" }
        val currency = record.refund?.currency ?: Currency.THB
        val refund = refundAmount.trim().takeIf { it.isNotEmpty() }?.let { parseNonNegativeMoney(it, currency) }
        store.updateReturn(returnId, status, refund, tracking.trim().takeIf { it.isNotEmpty() }, notes.trim().takeIf { it.isNotEmpty() })
    }

    private suspend fun perform(block: () -> Unit) = withContext(dispatcher) {
        mutex.withLock {
            mutableState.value = mutableState.value.copy(busy = true, error = null)
            try {
                block()
                val order = selectedOrderId?.let(store::getOrder)
                val ids = order?.shipments.orEmpty().map { it.id }
                val products = store.listProducts()
                mutableState.value = ShopSnapshot(
                    products = products,
                    offers = store.offersForProducts(products.map { it.id }),
                    orders = store.listOrders(),
                    selectedOrder = order,
                    events = ids.associateWith(store::events),
                    shipmentLabels = ids.mapNotNull { id -> store.shipmentLabel(id)?.let { id to it } }.toMap(),
                    returns = order?.let { store.returnsForOrder(it.id) }.orEmpty(),
                    language = AppLanguage.entries.firstOrNull { it.name == store.preference("language") } ?: AppLanguage.ENGLISH,
                )
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                mutableState.value = mutableState.value.copy(error = failure.message ?: "Operation failed")
            } finally {
                mutableState.value = mutableState.value.copy(busy = false)
            }
        }
    }
}
