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

data class SyncChange(
    val collection: String,
    val id: String,
    val updatedAt: Long,
    val originDevice: String,
    val deletedAt: Long?,
    val payload: String?,
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
    private val collections: Set<String> = setOf("settings", "watchlist"),
) {
    fun localChanges(cursor: SyncCursor, limit: Int = 100): SyncBatch {
        val metas = store.syncChanges(cursor, collections, limit)
        val changes = metas.map { meta ->
            val payload = if (meta.deletedAt != null) null else when (meta.collection) {
                "settings" -> store.preference(meta.id)
                "watchlist" -> store.watchlistPayload(meta.id)
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
                else -> error("Unsupported sync collection")
            }
            applied++
        }
        return applied
    }
}
