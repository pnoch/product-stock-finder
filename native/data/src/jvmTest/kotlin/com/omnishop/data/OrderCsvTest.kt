package com.omnishop.data

import com.omnishop.core.Currency
import com.omnishop.core.Money
import kotlin.test.*

class OrderCsvTest {
    private fun importer(): OrderCsvImporter {
        var id = 0
        return OrderCsvImporter { "id-${++id}" }
    }

    private val valid = """
        merchant,order_id,purchased_at,currency,currency_scale,item_title,quantity,unit_price,shipping,tax,discount,total,payment_label
        Shop,M1,2026-10-01,THB,2,Tablet,1,8000.00,50.00,0.00,100.00,8150.00,Visa
        Shop,M1,,,,Case,2,100.00,,,,,
    """.trimIndent()

    @Test fun parsesOrderHeaderItemsAndMoney() {
        val result = importer().parse(valid.encodeToByteArray())
        assertTrue(result.errors.isEmpty(), result.errors.joinToString())
        val order = result.orders.single()
        assertEquals("Shop", order.merchant)
        assertEquals("M1", order.merchantOrderId)
        assertEquals(Currency.THB, order.currency)
        assertEquals(2, order.items.size)
        assertEquals(Money(800_000, Currency.THB), order.items[0].unitPrice)
        assertEquals(Money(10_000, Currency.THB), order.items[1].unitPrice)
        assertEquals(Money(820_000, Currency.THB), order.itemSubtotal)
        assertEquals(Money(5_000, Currency.THB), order.shipping)
        assertEquals(Money(815_000, Currency.THB), order.totalPaid)
        assertEquals("Visa", order.paymentMethodLabel)
        assertNotNull(order.purchasedAtEpochMillis)
    }

    @Test fun handlesQuotedFieldsBomAndCrlf() {
        val csv = "\uFEFFmerchant,order_id,currency,item_title,quantity,unit_price\r\n" +
            "Shop,M2,THB,\"Tablet, 256GB\",1,10.00\r\n"
        val result = importer().parse(csv.encodeToByteArray())
        assertTrue(result.errors.isEmpty(), result.errors.joinToString())
        assertEquals("Tablet, 256GB", result.orders.single().items.single().title)
    }

    @Test fun groupsMultipleOrdersAndRejectsConflictingOrderFields() {
        val multi = """
            merchant,order_id,currency,item_title,quantity,shipping
            A,1,THB,One,1,10.00
            B,2,THB,Two,1,
        """.trimIndent()
        val parsed = importer().parse(multi.encodeToByteArray())
        assertTrue(parsed.errors.isEmpty(), parsed.errors.joinToString())
        assertEquals(setOf("A", "B"), parsed.orders.map { it.merchant }.toSet())

        val conflict = """
            merchant,order_id,currency,item_title,quantity,shipping
            A,1,THB,One,1,10.00
            A,1,THB,Two,1,20.00
        """.trimIndent()
        val failed = importer().parse(conflict.encodeToByteArray())
        assertTrue(failed.orders.isEmpty())
        assertTrue(failed.errors.any { it.contains("shipping differs") })
    }

    @Test fun reportsBadHeadersFieldsAndUnclosedQuotes() {
        val missing = importer().parse("merchant,order_id\nA,1".encodeToByteArray())
        assertTrue(missing.errors.single().contains("Missing columns"))

        val invalidQuantity = importer().parse("merchant,order_id,currency,item_title,quantity\nA,1,THB,One,0".encodeToByteArray())
        assertTrue(invalidQuantity.errors.any { it.contains("positive quantity") })

        val invalidDate = importer().parse("merchant,order_id,currency,item_title,quantity,purchased_at\nA,1,THB,One,1,10/01/2026".encodeToByteArray())
        assertTrue(invalidDate.errors.any { it.contains("YYYY-MM-DD") })

        val invalidAmount = importer().parse("merchant,order_id,currency,item_title,quantity,unit_price\nA,1,THB,One,1,-1".encodeToByteArray())
        assertTrue(invalidAmount.errors.any { it.contains("unit_price") })

        val unclosed = importer().parse("merchant,order_id,currency,item_title,quantity\nA,1,THB,\"One,1".encodeToByteArray())
        assertTrue(unclosed.errors.single().contains("could not be read"))
    }
}
