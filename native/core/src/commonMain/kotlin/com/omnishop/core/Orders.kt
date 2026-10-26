package com.omnishop.core

enum class ShipmentStatus {
    ORDER_PLACED, PAYMENT_CONFIRMED, PREPARING, READY_TO_SHIP, SHIPPED, PICKED_UP,
    IN_TRANSIT, CUSTOMS_CLEARANCE, ARRIVED_AT_LOCAL_FACILITY, OUT_FOR_DELIVERY,
    DELIVERY_ATTEMPTED, DELIVERED, EXCEPTION, RETURNING_TO_SENDER, RETURNED, LOST,
    CANCELLED, UNKNOWN,
}

data class OrderItem(
    val id: String,
    val title: String,
    val quantity: Int,
    val unitPrice: Money? = null,
) {
    init {
        require(id.isNotBlank() && title.isNotBlank())
        require(quantity > 0)
        require(unitPrice == null || unitPrice.minorUnits >= 0)
    }
}

data class ShipmentAllocation(val orderItemId: String, val quantity: Int) {
    init {
        require(orderItemId.isNotBlank() && quantity > 0)
    }
}

data class Shipment(
    val id: String,
    val allocations: List<ShipmentAllocation>,
    val status: ShipmentStatus = ShipmentStatus.UNKNOWN,
    val carrierId: String? = null,
) {
    init {
        require(id.isNotBlank() && allocations.isNotEmpty())
        require(allocations.map { it.orderItemId }.distinct().size == allocations.size)
        require(carrierId == null || (carrierId.isNotBlank() && carrierId.length <= 64))
    }
}

enum class DeliveryProgress { NOT_SHIPPED, IN_PROGRESS, PARTIALLY_DELIVERED, DELIVERED }

data class PurchaseOrder(
    val id: String,
    val merchant: String,
    val items: List<OrderItem>,
    val shipments: List<Shipment> = emptyList(),
    val currency: Currency? = null,
    val shipping: Money? = null,
    val tax: Money? = null,
    val discount: Money? = null,
    val totalPaid: Money? = null,
    val merchantOrderId: String? = null,
    val purchasedAtEpochMillis: Long? = null,
    val paymentMethodLabel: String? = null,
) {
    init {
        require(id.isNotBlank() && merchant.isNotBlank() && items.isNotEmpty())
        require(items.map { it.id }.distinct().size == items.size)
        require(shipments.map { it.id }.distinct().size == shipments.size)
        val itemById = items.associateBy { it.id }
        val allocations = shipments.flatMap { it.allocations }.groupBy { it.orderItemId }
        allocations.forEach { (itemId, assigned) ->
            val item = requireNotNull(itemById[itemId]) { "Shipment references an unknown order item" }
            require(assigned.sumOf { it.quantity.toLong() } <= item.quantity) { "Shipment quantity exceeds order quantity" }
        }
        val monies = listOfNotNull(shipping, tax, discount, totalPaid) + items.mapNotNull { it.unitPrice }
        if (monies.isNotEmpty()) require(currency != null) { "Order currency is required when money is present" }
        monies.forEach { require(it.currency == currency && it.minorUnits >= 0) { "Order money must share a non-negative currency" } }
        require(merchantOrderId == null || (merchantOrderId.isNotBlank() && merchantOrderId.length <= 128))
        require(purchasedAtEpochMillis == null || purchasedAtEpochMillis >= 0)
        require(paymentMethodLabel == null || paymentMethodLabel.length <= 64)
    }

    val itemSubtotal: Money?
        get() {
            val orderCurrency = currency ?: return null
            if (items.any { it.unitPrice == null }) return null
            return items.fold(Money(0, orderCurrency)) { total, item ->
                total + (item.unitPrice!! * item.quantity)
            }
        }

    val computedTotal: Money?
        get() {
            val subtotal = itemSubtotal ?: return null
            val knownShipping = shipping ?: return null
            val knownTax = tax ?: return null
            val knownDiscount = discount ?: return null
            return subtotal + knownShipping + knownTax - knownDiscount
        }

    val deliveredUnits: Long get() = shipments.filter { it.status == ShipmentStatus.DELIVERED }
        .sumOf { shipment -> shipment.allocations.sumOf { it.quantity.toLong() } }

    val deliveryProgress: DeliveryProgress
        get() = when {
            deliveredUnits == items.sumOf { it.quantity.toLong() } -> DeliveryProgress.DELIVERED
            deliveredUnits > 0 -> DeliveryProgress.PARTIALLY_DELIVERED
            shipments.isNotEmpty() -> DeliveryProgress.IN_PROGRESS
            else -> DeliveryProgress.NOT_SHIPPED
        }
}
