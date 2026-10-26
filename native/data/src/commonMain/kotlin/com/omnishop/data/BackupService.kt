package com.omnishop.data

import com.omnishop.core.*
import com.omnishop.data.security.*
import kotlinx.serialization.json.Json

class BackupService(
    private val store: ShoppingStore,
    private val crypto: BackupCrypto,
    private val privateService: OrderPrivateService,
) {
    private val json = Json {
        encodeDefaults = true
        explicitNulls = false
        ignoreUnknownKeys = false
    }

    fun export(password: CharArray, createdAtEpochMillis: Long): ByteArray {
        val snapshot = store.snapshot().copy(
            privateFields = privateService.exportAll().map {
                BackupPrivateField(it.orderId, it.field, it.value)
            },
        )
        val plaintext = json.encodeToString(BackupSnapshot.serializer(), snapshot).encodeToByteArray()
        return EncryptedBackup.encrypt(plaintext, password, createdAtEpochMillis, crypto)
    }

    fun restore(backup: ByteArray, password: CharArray): BackupCounts {
        val plaintext = EncryptedBackup.decrypt(backup, password, crypto)
        val snapshot = try {
            json.decodeFromString(BackupSnapshot.serializer(), plaintext.decodeToString())
        } catch (failure: Exception) {
            throw BackupFormatException("Backup contents are invalid", failure)
        }
        try {
            validate(snapshot)
        } catch (failure: IllegalArgumentException) {
            throw BackupFormatException("Backup contents are invalid", failure)
        }
        // Re-encrypt private fields with this device's key; the backup is
        // password-encrypted, so plaintext never reaches disk outside it.
        val privateRows = privateService.encryptForRestore(
            snapshot.privateFields.map { PrivateValue(it.orderId, it.field, it.value) },
        )
        return store.replaceAll(snapshot, privateRows)
    }

    private fun validate(snapshot: BackupSnapshot) {
        fun fail(message: String): Nothing = throw BackupFormatException(message)
        fun <T> unique(items: List<T>, id: (T) -> String, label: String) {
            val seen = HashSet<String>()
            items.forEach { if (!seen.add(id(it))) fail("Duplicate $label id") }
        }

        if (snapshot.schemaVersion !in 1..3) fail("Unsupported backup schema")
        if (snapshot.schemaVersion == 1 && snapshot.returns.isNotEmpty()) fail("Returns require backup schema 2")
        if (snapshot.schemaVersion < 3 && snapshot.shipments.any { it.carrierId != null }) {
            fail("Carrier ids require backup schema 3")
        }
        unique(snapshot.products, { it.id }, "product")
        unique(snapshot.listings, { it.id }, "listing")
        unique(snapshot.orders, { it.id }, "order")
        unique(snapshot.orderItems, { it.id }, "order item")
        unique(snapshot.shipments, { it.id }, "shipment")
        unique(snapshot.preferences, { it.key }, "preference")
        unique(snapshot.allocations, { "${it.shipmentId}\u0000${it.orderItemId}" }, "allocation")
        unique(snapshot.events, { "${it.shipmentId}\u0000${it.source}\u0000${it.sourceEventId}" }, "event")
        unique(snapshot.observations, { "${it.listingId}\u0000${it.observedAt}" }, "observation")

        val productIds = snapshot.products.map { it.id }.toSet()
        val orderIds = snapshot.orders.map { it.id }.toSet()
        val itemIds = snapshot.orderItems.map { it.id }.toSet()
        val shipmentIds = snapshot.shipments.map { it.id }.toSet()
        val listingIds = snapshot.listings.map { it.id }.toSet()

        snapshot.products.forEach {
            if (it.id.isBlank() || it.title.isBlank() || it.savedAt < 0) fail("Invalid product")
            if (it.sourceUrl != null && !it.sourceUrl.startsWith("https://")) fail("Invalid product link")
        }
        snapshot.listings.forEach {
            if (it.id.isBlank() || it.productId !in productIds || it.sourceLabel.isBlank()) fail("Invalid offer")
            val currency = currency(it.currencyCode, it.currencyScale)
            val price = Money(it.priceMinor, currency)
            CostEstimate(price,
                cost(it.shippingMinor, currency), cost(it.taxesMinor, currency),
                cost(it.feesMinor, currency), Money(it.discountMinor, currency))
        }
        snapshot.observations.forEach {
            if (it.listingId !in listingIds || it.observedAt < 0 || it.source.isBlank()) fail("Invalid price observation")
            Money(it.priceMinor, currency(it.currencyCode, it.currencyScale))
        }
        snapshot.orders.forEach {
            if (it.id.isBlank() || it.merchant.isBlank() || it.createdAt < 0) fail("Invalid order")
        }
        snapshot.orderItems.forEach {
            if (it.id.isBlank() || it.orderId !in orderIds || it.title.isBlank() || it.quantity <= 0) fail("Invalid order item")
        }
        snapshot.shipments.forEach {
            if (it.id.isBlank() || it.orderId !in orderIds || it.trackingNumber.isBlank() || it.carrierLabel.isBlank()) fail("Invalid shipment")
            if (it.carrierId != null && (it.carrierId.isBlank() || it.carrierId.length > 64)) fail("Invalid carrier id")
            status(it.status)
        }
        snapshot.allocations.forEach {
            if (it.shipmentId !in shipmentIds || it.orderItemId !in itemIds || it.orderId !in orderIds || it.quantity <= 0) fail("Invalid allocation")
        }
        snapshot.events.forEach {
            if (it.shipmentId !in shipmentIds || it.source.isBlank() || it.sourceEventId.isBlank() ||
                it.description.isBlank() || it.importedAt < 0) fail("Invalid tracking event")
            status(it.status)
            method(it.method)
        }
        snapshot.preferences.forEach { if (it.key.isBlank()) fail("Invalid preference") }
        unique(snapshot.privateFields, { "${it.orderId}\u0000${it.field}" }, "private field")
        snapshot.privateFields.forEach {
            if (it.orderId !in orderIds || it.field.isBlank() || it.field.length > 64 ||
                it.value.isBlank() || it.value.length > OrderPrivateService.MAX_VALUE_LENGTH) fail("Invalid private field")
        }
        unique(snapshot.returns, { it.id }, "return")
        val returnsByOrder = snapshot.returns.map { it.toRecord() }.groupBy { it.orderId }
        if (returnsByOrder.keys.any { it !in orderIds }) fail("Return references an unknown order")

        // Reuse domain invariants for the relationships that matter most.
        snapshot.orders.forEach { order ->
            val items = snapshot.orderItems.filter { it.orderId == order.id }
                .map { OrderItem(it.id, it.title, it.quantity) }
            if (items.isEmpty()) fail("Order has no items")
            val shipments = snapshot.shipments.filter { it.orderId == order.id }.map { shipment ->
                val allocations = snapshot.allocations.filter { it.shipmentId == shipment.id }
                if (allocations.isEmpty() || allocations.any { it.orderId != order.id }) fail("Invalid shipment allocation")
                Shipment(shipment.id, allocations.map { ShipmentAllocation(it.orderItemId, it.quantity) }, status(shipment.status), shipment.carrierId)
            }
            val purchase = PurchaseOrder(order.id, order.merchant, items, shipments)
            validateOrderReturns(purchase, returnsByOrder[order.id].orEmpty())
        }
    }

    private fun currency(code: String, scale: Int): Currency = try {
        Currency(code, scale)
    } catch (failure: IllegalArgumentException) {
        throw BackupFormatException("Invalid currency", failure)
    }

    private fun cost(amount: Long?, currency: Currency): Cost =
        amount?.let { Cost.Known(Money(it, currency)) } ?: Cost.Unknown

    private fun status(value: String): ShipmentStatus = try {
        ShipmentStatus.valueOf(value)
    } catch (failure: IllegalArgumentException) {
        throw BackupFormatException("Invalid shipment status", failure)
    }

    private fun method(value: String): ObservationMethod = try {
        ObservationMethod.valueOf(value)
    } catch (failure: IllegalArgumentException) {
        throw BackupFormatException("Invalid observation method", failure)
    }
}
