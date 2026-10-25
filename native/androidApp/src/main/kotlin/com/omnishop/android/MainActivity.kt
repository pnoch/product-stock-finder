package com.omnishop.android

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.omnishop.app.OmniShopApp
import com.omnishop.app.ShopPresenter
import com.omnishop.data.ShoppingStore
import com.omnishop.data.openAndroid
import java.util.UUID

class MainActivity : ComponentActivity() {
    private lateinit var store: ShoppingStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = ShoppingStore.openAndroid(applicationContext)
        val presenter = ShopPresenter(store, { UUID.randomUUID().toString() }, System::currentTimeMillis)
        setContent {
            OmniShopApp(presenter) { url -> startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        store.close()
    }
}
