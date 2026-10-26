package com.omnishop.core

enum class ReturnStatus {
    REQUESTED, APPROVED, ITEM_RETURNED, PROCESSING, PARTIALLY_REFUNDED, REFUNDED, REJECTED, DISPUTED;

    val requiresRefundAmount: Boolean get() = this == PARTIALLY_REFUNDED || this == REFUNDED
}

data class ReturnRecord(
    val id: String,
    val orderId: String,
    val orderItemId: String,
    val quantity: Int,
    val reason: String,
    val status: ReturnStatus,
    val requestedAtEpochMillis: Long,
    val returnTrackingNumber: String? = null,
    val refund: Money? = null,
    val notes: String? = null,
) {
    init {
        require(id.isNotBlank() && orderId.isNotBlank() && orderItemId.isNotBlank())
        require(quantity > 0)
        require(reason.isNotBlank() && reason.length <= 500)
        require(requestedAtEpochMillis >= 0)
        require(returnTrackingNumber == null || (returnTrackingNumber.isNotBlank() && returnTrackingNumber.length <= 256))
        require(refund == null || refund.minorUnits >= 0)
        require(!status.requiresRefundAmount || (refund != null && refund.minorUnits > 0)) {
            "Record a positive refund amount before marking a refund received"
        }
        require(notes == null || notes.length <= 2_000)
    }

    val reservesQuantity: Boolean get() = status != ReturnStatus.REJECTED
}

fun validateOrderReturns(order: PurchaseOrder, records: List<ReturnRecord>) {
    require(records.map { it.id }.distinct().size == records.size) { "Duplicate return id" }
    val items = order.items.associateBy { it.id }
    records.forEach {
        require(it.orderId == order.id && it.orderItemId in items) { "Return references another order's item" }
        require(it.quantity <= items.getValue(it.orderItemId).quantity) { "Return quantity exceeds the ordered quantity" }
    }
    records.filter { it.reservesQuantity }.groupBy { it.orderItemId }.forEach { (itemId, returns) ->
        require(returns.sumOf { it.quantity.toLong() } <= items.getValue(itemId).quantity.toLong()) {
            "Return quantity exceeds the ordered quantity"
        }
    }
}
