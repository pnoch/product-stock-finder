package com.omnishop.data

import app.cash.sqldelight.driver.native.NativeSqliteDriver
import com.omnishop.data.db.OmniShopDatabase

fun openIosStore(): ShoppingStore {
    val driver = NativeSqliteDriver(OmniShopDatabase.Schema, "omnishop.db")
    driver.execute(null, "PRAGMA foreign_keys = ON", 0)
    return ShoppingStore(driver)
}
