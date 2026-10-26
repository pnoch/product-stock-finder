package com.omnishop.core

import kotlin.test.*

class ReturnsTest {
    private fun record(status: ReturnStatus = ReturnStatus.REQUESTED, refund: Money? = null) =
        ReturnRecord("r", "o", "i", 1, "Damaged", status, 100, refund = refund)

    @Test fun refundReceivedStatesRequireAPositiveRecordedAmount() {
        listOf(ReturnStatus.PARTIALLY_REFUNDED, ReturnStatus.REFUNDED).forEach { status ->
            assertFailsWith<IllegalArgumentException> { record(status) }
            assertFailsWith<IllegalArgumentException> { record(status, Money(0, Currency.THB)) }
            assertEquals(Money(1, Currency.THB), record(status, Money(1, Currency.THB)).refund)
        }
    }

    @Test fun rejectsInvalidAmountsTextAndQuantities() {
        assertFailsWith<IllegalArgumentException> { record(refund = Money(-1, Currency.THB)) }
        assertFailsWith<IllegalArgumentException> { record().copy(quantity = 0) }
        assertFailsWith<IllegalArgumentException> { record().copy(reason = " ") }
        assertFailsWith<IllegalArgumentException> { record().copy(notes = "x".repeat(2001)) }
        assertFailsWith<IllegalArgumentException> { record().copy(returnTrackingNumber = " ") }
    }

    @Test fun validatesItemOwnershipAndCumulativeQuantity() {
        val order = PurchaseOrder("o", "Shop", listOf(OrderItem("i", "Tablet", 1)))
        validateOrderReturns(order, listOf(record()))
        assertFailsWith<IllegalArgumentException> { validateOrderReturns(order, listOf(record().copy(orderId = "other"))) }
        assertFailsWith<IllegalArgumentException> { validateOrderReturns(order, listOf(record().copy(orderItemId = "other"))) }
        assertFailsWith<IllegalArgumentException> { validateOrderReturns(order, listOf(record(), record().copy(id = "second"))) }
    }

    @Test fun rejectedRequestsReleaseTheirReservedQuantity() {
        val order = PurchaseOrder("o", "Shop", listOf(OrderItem("i", "Tablet", 1)))
        validateOrderReturns(order, listOf(record(ReturnStatus.REJECTED), record().copy(id = "retry")))
        assertFalse(record(ReturnStatus.REJECTED).reservesQuantity)
        assertTrue(record(ReturnStatus.DISPUTED).reservesQuantity)
    }
}
