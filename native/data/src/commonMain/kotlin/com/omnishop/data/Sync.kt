package com.omnishop.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

data class SyncCursor(val updatedAt: Long, val originDevice: String, val id: String) {
    companion object {
        val START = SyncCursor(0, "", "")
    }
}

data class SyncMeta(
    val collection: String,
    val id: String,
    val updatedAt: Long,
    val originDevice: String,
    val deletedAt: Long?,
)

@Serializable data class SyncChange(
    val collection: String,
    val id: String,
    val updatedAt: Long,
    val originDevice: String,
    val deletedAt: Long?,
    val payload: String?,
)

@Serializable data class SyncPackage(
    val version: Int = 1,
    val changes: List<SyncChange>,
)

data class SyncBatch(val changes: List<SyncChange>, val cursor: SyncCursor)

@Serializable data class SyncProduct(
    val id: String, val title: String, val sourceUrl: String?, val savedAt: Long,
)
@Serializable data class SyncListing(
    val id: String, val productId: String, val sourceLabel: String, val priceMinor: Long,
    val currencyCode: String, val currencyScale: Int, val shippingMinor: Long?,
    val taxesMinor: Long?, val feesMinor: Long?, val discountMinor: Long,
)
@Serializable data class SyncObservation(
    val listingId: String, val observedAt: Long, val priceMinor: Long,
    val currencyCode: String, val currencyScale: Int, val source: String,
)
@Serializable data class SyncOrder(
    val id: String, val merchant: String, val createdAt: Long,
    val currencyCode: String? = null, val currencyScale: Int? = null,
    val shippingMinor: Long? = null, val taxMinor: Long? = null, val discountMinor: Long? = null,
    val totalMinor: Long? = null, val merchantOrderId: String? = null,
    val purchasedAt: Long? = null, val paymentMethodLabel: String? = null,
)
@Serializable data class SyncOrderItem(
    val id: String, val orderId: String, val title: String, val quantity: Int,
    val unitPriceMinor: Long? = null,
)
@Serializable data class SyncShipment(
    val id: String, val orderId: String, val trackingNumber: String, val carrierLabel: String,
    val status: String, val carrierId: String? = null,
)
@Serializable data class SyncAllocation(
    val shipmentId: String, val orderId: String, val orderItemId: String, val quantity: Int,
)
@Serializable data class SyncEvent(
    val shipmentId: String, val source: String, val sourceEventId: String, val status: String,
    val description: String, val method: String, val importedAt: Long, val occurredAt: Long?,
    val originalTimestamp: String?, val originalTimezone: String?,
)
@Serializable data class SyncReturn(
    val id: String, val orderId: String, val orderItemId: String, val quantity: Int,
    val reason: String, val status: String, val requestedAt: Long, val returnTracking: String?,
    val refundMinor: Long?, val currencyCode: String?, val currencyScale: Int?, val notes: String?,
)
@Serializable data class OrderPayload(
    val order: SyncOrder,
    val items: List<SyncOrderItem> = emptyList(),
    val shipments: List<SyncShipment> = emptyList(),
    val allocations: List<SyncAllocation> = emptyList(),
    val events: List<SyncEvent> = emptyList(),
    val returns: List<SyncReturn> = emptyList(),
)

@Serializable data class WatchlistPayload(
    val product: SyncProduct,
    val listings: List<SyncListing> = emptyList(),
    val observations: List<SyncObservation> = emptyList(),
)

object SyncJson {
    val json = Json {
        encodeDefaults = true
        ignoreUnknownKeys = false
    }
}

/**
 * Collection-agnostic LWW engine for the local sync metadata. Transport,
 * authentication and pairing are separate; this class never opens a socket.
 */
class SyncEngine(
    private val store: ShoppingStore,
    private val collections: Set<String> = setOf("settings", "watchlist", "orders"),
) {
    fun localChanges(cursor: SyncCursor, limit: Int = 100): SyncBatch {
        val metas = store.syncChanges(cursor, collections, limit)
        val changes = metas.map { meta ->
            val payload = if (meta.deletedAt != null) null else when (meta.collection) {
                "settings" -> store.preference(meta.id)
                "watchlist" -> store.watchlistPayload(meta.id)
                "orders" -> store.orderPayload(meta.id)
                else -> error("Unsupported sync collection ${meta.collection}")
            }
            require(meta.deletedAt != null || payload != null) {
                "Missing local payload for ${meta.collection}/${meta.id}"
            }
            SyncChange(meta.collection, meta.id, meta.updatedAt, meta.originDevice, meta.deletedAt, payload)
        }
        val next = metas.lastOrNull()?.let { SyncCursor(it.updatedAt, it.originDevice, it.id) } ?: cursor
        return SyncBatch(changes, next)
    }

    fun apply(changes: List<SyncChange>): Int {
        var applied = 0
        changes.forEach { change ->
            require(change.collection in collections) { "Unsupported sync collection" }
            require(change.id.isNotBlank() && change.originDevice.isNotBlank()) { "Invalid sync change" }
            require(change.updatedAt >= 0 && (change.deletedAt == null || change.deletedAt >= 0)) {
                "Invalid sync timestamps"
            }
            require(change.deletedAt != null || change.payload != null) { "Missing sync payload" }
            val local = store.syncMeta(change.collection, change.id)
            val remoteWins = local == null || change.updatedAt > local.updatedAt ||
                (change.updatedAt == local.updatedAt && change.originDevice > local.originDevice)
            if (!remoteWins) return@forEach
            when (change.collection) {
                "settings" -> store.applySettingSync(change)
                "watchlist" -> store.applyWatchlistSync(change)
                "orders" -> store.applyOrderSync(change)
                else -> error("Unsupported sync collection")
            }
            applied++
        }
        return applied
    }
}
