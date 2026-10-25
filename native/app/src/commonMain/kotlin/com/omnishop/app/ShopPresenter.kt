package com.omnishop.app

import com.omnishop.core.*
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

data class ShopSnapshot(
    val products: List<SavedProduct> = emptyList(),
    val offers: Map<String, List<Offer>> = emptyMap(),
    val orders: List<OrderSummary> = emptyList(),
    val selectedOrder: PurchaseOrder? = null,
    val events: Map<String, List<TrackingEvent>> = emptyMap(),
    val shipmentLabels: Map<String, ShipmentLabel> = emptyMap(),
    val language: AppLanguage = AppLanguage.ENGLISH,
    val busy: Boolean = false,
    val error: String? = null,
)

class ShopPresenter(
    private val store: ShoppingStore,
    private val newId: () -> String,
    private val now: () -> Long,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
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

    suspend fun createOrder(product: SavedProduct, merchant: String, quantity: Int) = perform {
        val orderId = newId()
        store.createOrder(PurchaseOrder(orderId, merchant.trim(), listOf(OrderItem(newId(), product.title, quantity))), now())
        selectedOrderId = orderId
    }

    suspend fun addOffer(productId: String, source: String, amount: String, shipping: String) = perform {
        val price = parseNonNegativeMoney(amount.trim(), Currency.THB)
        val shippingCost = shipping.trim().takeIf { it.isNotEmpty() }
            ?.let { Cost.Known(parseNonNegativeMoney(it, Currency.THB)) } ?: Cost.Unknown
        store.saveOffer(Offer(newId(), productId, source.trim(), CostEstimate(price, shipping = shippingCost)), now())
    }

    suspend fun selectOrder(id: String?) = perform { selectedOrderId = id }

    suspend fun attachShipment(tracking: String, carrier: String, quantity: Int) = perform {
        val order = requireNotNull(selectedOrderId?.let(store::getOrder)) { "Select an order first" }
        val item = order.items.single()
        store.attachShipment(order.id, Shipment(newId(), listOf(ShipmentAllocation(item.id, quantity))), tracking.trim(), carrier.trim())
    }

    suspend fun recordManualEvent(shipmentId: String, status: ShipmentStatus, description: String) = perform {
        store.recordEvent(TrackingEvent(shipmentId, "manual", newId(), status, description.trim(), ObservationMethod.MANUAL, now()))
    }

    suspend fun changeLanguage(language: AppLanguage) = perform { store.setPreference("language", language.name) }

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
