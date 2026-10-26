package com.omnishop.data

import com.omnishop.core.*
import java.nio.file.Files
import java.nio.file.Path
import java.sql.DriverManager
import kotlin.test.*

class CarrierMigrationTest {
    @Test fun addsCarrierIdToVersionTwoShipmentsWithoutLosingThem() {
        val file = Files.createTempDirectory("omnishop-carrier-migration").resolve("shop.db")
        try {
            Files.copy(Path.of("src/commonMain/sqldelight/databases/2.db"), file)
            Class.forName("org.sqlite.JDBC")
            DriverManager.getConnection("jdbc:sqlite:$file").use { connection ->
                connection.createStatement().use { sql ->
                    sql.execute("PRAGMA user_version = 2")
                    sql.execute("INSERT INTO purchase_order VALUES ('o', 'Shop', 100)")
                    sql.execute("INSERT INTO order_item VALUES ('i', 'o', 'Tablet', 2)")
                    sql.execute("INSERT INTO shipment VALUES ('s', 'o', 'TRACK', 'Manual', 'IN_TRANSIT')")
                    sql.execute("INSERT INTO shipment_item VALUES ('s', 'o', 'i', 1)")
                }
            }
            ShoppingStore.open(file.toFile()).use { store ->
                val shipment = store.getOrder("o")!!.shipments.single()
                assertEquals("TRACK", store.shipmentLabel("s")!!.trackingNumber)
                assertNull(shipment.carrierId)
                store.attachShipment("o",
                    Shipment("s2", listOf(ShipmentAllocation("i", 1)), ShipmentStatus.SHIPPED, "thailandpost"),
                    "TRACK2", "Thailand Post", "thailandpost")
            }
            ShoppingStore.open(file.toFile()).use { store ->
                assertEquals("thailandpost", store.getOrder("o")!!.shipments.first { it.id == "s2" }.carrierId)
            }
        } finally {
            file.parent.toFile().deleteRecursively()
        }
    }
}
