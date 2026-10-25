package com.omnishop.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class MoneyTest {
    @Test fun addsExactMinorUnits() {
        assertEquals(30L, (Money(10, Currency.THB) + Money(20, Currency.THB)).minorUnits)
    }

    @Test fun rejectsMixedCurrencies() {
        assertFailsWith<IllegalArgumentException> {
            Money(10, Currency.THB) + Money(10, Currency.USD)
        }
    }

    @Test fun rejectsOverflowInBothDirections() {
        assertFailsWith<IllegalArgumentException> { Money(Long.MAX_VALUE, Currency.THB) + Money(1, Currency.THB) }
        assertFailsWith<IllegalArgumentException> { Money(Long.MIN_VALUE, Currency.THB) + Money(-1, Currency.THB) }
        assertFailsWith<IllegalArgumentException> { Money(Long.MIN_VALUE, Currency.THB) - Money(1, Currency.THB) }
        assertFailsWith<IllegalArgumentException> { Money(Long.MAX_VALUE, Currency.THB) - Money(-1, Currency.THB) }
    }

    @Test fun subtractionDoesNotNegateLongMinValue() {
        assertEquals(0L, (Money(Long.MIN_VALUE, Currency.THB) - Money(Long.MIN_VALUE, Currency.THB)).minorUnits)
    }

    @Test fun validatesCurrencyIdentityAndScale() {
        assertFailsWith<IllegalArgumentException> { Currency("thb", 2) }
        assertFailsWith<IllegalArgumentException> { Currency("THB", -1) }
        assertFailsWith<IllegalArgumentException> { Currency("THB", 5) }
    }

    @Test fun unknownShippingIsNotFreeShipping() {
        val quote = CostEstimate(Money(10000, Currency.THB))
        assertNull(quote.total)
        assertEquals(setOf(CostPart.SHIPPING, CostPart.TAXES, CostPart.FEES), quote.unknownParts)
    }

    @Test fun computesDeliveredTotalOnlyWhenAllCostsAreKnown() {
        val quote = CostEstimate(
            itemPrice = Money(10000, Currency.THB),
            shipping = Cost.Known(Money(0, Currency.THB)),
            taxes = Cost.Known(Money(700, Currency.THB)),
            fees = Cost.Known(Money(100, Currency.THB)),
            discount = Money(500, Currency.THB),
        )
        assertEquals(Money(10300, Currency.THB), quote.total)
    }

    @Test fun rejectsNegativePricesAndMismatchedCostCurrencies() {
        assertFailsWith<IllegalArgumentException> { CostEstimate(Money(-1, Currency.THB)) }
        assertFailsWith<IllegalArgumentException> {
            CostEstimate(Money(100, Currency.THB), shipping = Cost.Known(Money(1, Currency.USD)))
        }
    }

    @Test fun parsesAndFormatsAmountsWithoutFloatingPointRounding() {
        assertEquals(101L, parseNonNegativeMoney("1.01", Currency.THB).minorUnits)
        assertEquals("0.10", parseNonNegativeMoney("0.1", Currency.THB).decimalString())
        assertEquals("-92233720368547758.08", Money(Long.MIN_VALUE, Currency.THB).decimalString())
        listOf("1e4", "-1", "1.234", "NaN", "1,000", "9223372036854775808").forEach {
            assertFailsWith<IllegalArgumentException> { parseNonNegativeMoney(it, Currency.THB) }
        }
    }
}
