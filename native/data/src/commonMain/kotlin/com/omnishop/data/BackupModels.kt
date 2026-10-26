package com.omnishop.data

import kotlinx.serialization.Serializable

@Serializable
data class BackupSnapshot(
    val schemaVersion: Int = 1,
    val products: List<BackupProduct> = emptyList(),
    val listings: List<BackupListing> = emptyList(),
    val observations: List<BackupObservation> = emptyList(),
    val orders: List<BackupOrder> = emptyList(),
    val orderItems: List<BackupOrderItem> = emptyList(),
    val shipments: List<BackupShipment> = emptyList(),
    val allocations: List<BackupAllocation> = emptyList(),
    val events: List<BackupEvent> = emptyList(),
    val preferences: List<BackupPreference> = emptyList(),
    val privateFields: List<BackupPrivateField> = emptyList(),
)

@Serializable data class BackupProduct(val id: String, val title: String, val sourceUrl: String?, val savedAt: Long)
@Serializable data class BackupListing(
    val id: String, val productId: String, val sourceLabel: String, val priceMinor: Long,
    val currencyCode: String, val currencyScale: Int, val shippingMinor: Long?,
    val taxesMinor: Long?, val feesMinor: Long?, val discountMinor: Long,
)
@Serializable data class BackupObservation(
    val listingId: String, val observedAt: Long, val priceMinor: Long,
    val currencyCode: String, val currencyScale: Int, val source: String,
)
@Serializable data class BackupOrder(val id: String, val merchant: String, val createdAt: Long)
@Serializable data class BackupOrderItem(val id: String, val orderId: String, val title: String, val quantity: Int)
@Serializable data class BackupShipment(
    val id: String, val orderId: String, val trackingNumber: String,
    val carrierLabel: String, val status: String,
)
@Serializable data class BackupAllocation(
    val shipmentId: String, val orderId: String, val orderItemId: String, val quantity: Int,
)
@Serializable data class BackupEvent(
    val shipmentId: String, val source: String, val sourceEventId: String, val status: String,
    val description: String, val method: String, val importedAt: Long, val occurredAt: Long?,
    val originalTimestamp: String?, val originalTimezone: String?,
)
@Serializable data class BackupPreference(val key: String, val value: String)
@Serializable data class BackupPrivateField(val orderId: String, val field: String, val value: String)

data class BackupCounts(
    val products: Int, val offers: Int, val orders: Int, val shipments: Int, val events: Int,
)
