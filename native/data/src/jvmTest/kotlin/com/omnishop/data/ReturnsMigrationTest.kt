package com.omnishop.data

import com.omnishop.core.*
import java.nio.file.Files
import java.nio.file.Path
import java.sql.DriverManager
import kotlin.test.*

class ReturnsMigrationTest {
    @Test fun upgradesVersionOneWithoutLosingExistingProductsOrOrders() {
        val file = Files.createTempDirectory("omnishop-migration").resolve("shop.db")
        try {
            Files.copy(Path.of("src/commonMain/sqldelight/databases/1.db"), file)
            Class.forName("org.sqlite.JDBC")
            DriverManager.getConnection("jdbc:sqlite:$file").use { connection ->
                connection.createStatement().use { sql ->
                    sql.execute("PRAGMA user_version = 1")
                    sql.execute("INSERT INTO saved_product VALUES ('p', 'Existing tablet', NULL, 100)")
                    sql.execute("INSERT INTO purchase_order VALUES ('o', 'Existing shop', 100)")
                    sql.execute("INSERT INTO order_item VALUES ('i', 'o', 'Existing tablet', 1)")
                }
            }
            ShoppingStore.open(file.toFile()).use { store ->
                assertEquals("Existing tablet", store.listProducts().single().title)
                assertEquals("Existing shop", store.getOrder("o")!!.merchant)
                store.createReturn(ReturnRecord("r", "o", "i", 1, "Damaged", ReturnStatus.REQUESTED, 200))
            }
            ShoppingStore.open(file.toFile()).use { store ->
                assertEquals("r", store.returnsForOrder("o").single().id)
            }
        } finally {
            file.parent.toFile().deleteRecursively()
        }
    }
}
