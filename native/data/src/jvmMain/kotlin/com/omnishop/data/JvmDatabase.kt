package com.omnishop.data

import app.cash.sqldelight.db.QueryResult
import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver
import com.omnishop.data.db.OmniShopDatabase
import java.io.File
import java.util.Properties

fun ShoppingStore.Companion.open(
    file: File,
    originDevice: String = "local",
    clock: () -> Long = { System.currentTimeMillis() },
): ShoppingStore = openJdbc("jdbc:sqlite:${file.absolutePath}", originDevice, clock)

fun ShoppingStore.Companion.inMemory(
    originDevice: String = "local",
    clock: () -> Long = { System.currentTimeMillis() },
): ShoppingStore = openJdbc(JdbcSqliteDriver.IN_MEMORY, originDevice, clock)

private fun openJdbc(url: String, originDevice: String, clock: () -> Long): ShoppingStore {
    val driver = JdbcSqliteDriver(url, Properties().apply { setProperty("foreign_keys", "true") })
    try {
        val version = driver.executeQuery(null, "PRAGMA user_version", { cursor ->
            QueryResult.Value(if (cursor.next().value) cursor.getLong(0)!! else 0L)
        }, 0).value
        val schema = OmniShopDatabase.Schema
        require(version <= schema.version) { "Database was created by a newer OmniShop version" }
        OmniShopDatabase(driver).transaction {
            if (version == 0L) schema.create(driver)
            else if (version < schema.version) schema.migrate(driver, version, schema.version)
            driver.execute(null, "PRAGMA user_version = ${schema.version}", 0)
        }
        return ShoppingStore(driver, originDevice, clock)
    } catch (failure: Throwable) {
        driver.close()
        throw failure
    }
}
