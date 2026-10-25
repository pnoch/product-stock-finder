package com.omnishop.data

import android.content.Context
import app.cash.sqldelight.driver.android.AndroidSqliteDriver
import androidx.sqlite.db.SupportSQLiteDatabase
import com.omnishop.data.db.OmniShopDatabase

fun ShoppingStore.Companion.openAndroid(context: Context): ShoppingStore = ShoppingStore(
    AndroidSqliteDriver(OmniShopDatabase.Schema, context.applicationContext, "omnishop.db",
        callback = object : AndroidSqliteDriver.Callback(OmniShopDatabase.Schema) {
            override fun onConfigure(db: SupportSQLiteDatabase) {
                db.setForeignKeyConstraintsEnabled(true)
            }
        }),
)
