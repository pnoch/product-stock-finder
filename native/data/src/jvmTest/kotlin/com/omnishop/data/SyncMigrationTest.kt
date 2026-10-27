package com.omnishop.data

import java.nio.file.Files
import java.nio.file.Path
import java.sql.DriverManager
import kotlin.test.*

class SyncMigrationTest {
    @Test fun addsSyncMetadataToVersionFourWithoutLosingPreferences() {
        val file = Files.createTempDirectory("omnishop-sync-migration").resolve("shop.db")
        try {
            Files.copy(Path.of("src/commonMain/sqldelight/databases/4.db"), file)
            Class.forName("org.sqlite.JDBC")
            DriverManager.getConnection("jdbc:sqlite:$file").use { connection ->
                connection.createStatement().use { sql ->
                    sql.execute("PRAGMA user_version = 4")
                    sql.execute("INSERT INTO preference VALUES ('language', 'THAI')")
                    sql.execute("INSERT INTO saved_product VALUES ('p', 'Tablet', NULL, 100)")
                }
            }
            ShoppingStore.open(file.toFile(), "device-a") { 200 }.use { store ->
                assertEquals("THAI", store.preference("language"))
                assertEquals("Tablet", store.listProducts().single().title)
                store.setPreference("language", "ENGLISH")
                assertNotNull(store.syncMeta("settings", "language"))
                assertEquals("device-a", store.syncMeta("settings", "language")!!.originDevice)
            }
        } finally {
            file.parent.toFile().deleteRecursively()
        }
    }
}
