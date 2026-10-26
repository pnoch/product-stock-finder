package com.omnishop.data

import com.omnishop.core.*
import java.nio.file.Files
import java.nio.file.Path
import java.sql.DriverManager
import kotlin.test.*

class FinancialsMigrationTest {
    @Test fun addsFinancialsToVersionThreeOrdersWithoutLosingThem() {
        val file = Files.createTempDirectory("omnishop-financials-migration").resolve("shop.db")
        try {
            Files.copy(Path.of("src/commonMain/sqldelight/databases/3.db"), file)
            Class.forName("org.sqlite.JDBC")
            DriverManager.getConnection("jdbc:sqlite:$file").use { connection ->
                connection.createStatement().use { sql ->
                    sql.execute("PRAGMA user_version = 3")
                    sql.execute("INSERT INTO purchase_order VALUES ('o', 'Shop', 100)")
                    sql.execute("INSERT INTO order_item VALUES ('i', 'o', 'Tablet', 1)")
                }
            }
            ShoppingStore.open(file.toFile()).use { store ->
                val migrated = store.getOrder("o")!!
                assertNull(migrated.currency)
                assertNull(migrated.totalPaid)
                store.updateOrderFinancials("o", Currency.THB, Money(500, Currency.THB),
                    Money(700, Currency.THB), Money(200, Currency.THB), Money(11_000, Currency.THB),
                    "ORDER-1", 1_700_000_000_000, "Visa")
                store.updateOrderItemPrice("o", "i", Money(10_000, Currency.THB))
            }
            ShoppingStore.open(file.toFile()).use { store ->
                val restored = store.getOrder("o")!!
                assertEquals(Money(10_000, Currency.THB), restored.itemSubtotal)
                assertEquals(Money(11_000, Currency.THB), restored.totalPaid)
                assertEquals("ORDER-1", restored.merchantOrderId)
                assertEquals("Visa", restored.paymentMethodLabel)
                assertEquals("ORDER-1", store.findOrderByMerchantId("Shop", "ORDER-1")!!.merchantOrderId)
            }
        } finally {
            file.parent.toFile().deleteRecursively()
        }
    }
}
