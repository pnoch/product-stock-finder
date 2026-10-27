package com.omnishop.android

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.omnishop.app.OmniShopApp
import com.omnishop.app.ShopPresenter
import com.omnishop.carriers.ThailandPostAdapter
import com.omnishop.data.BackupService
import com.omnishop.data.CarrierSettings
import com.omnishop.data.ReceiptService
import com.omnishop.data.SyncPackageService
import com.omnishop.data.SyncService
import com.omnishop.data.UnavailableSyncService
import com.omnishop.sync.TlsSyncService
import com.omnishop.data.OrderPrivateService
import com.omnishop.data.security.JcaBackupCrypto
import com.omnishop.data.ShoppingStore
import com.omnishop.data.openAndroid
import java.util.UUID

class MainActivity : ComponentActivity() {
    private lateinit var store: ShoppingStore
    private lateinit var syncService: SyncService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = ShoppingStore.openAndroid(applicationContext)
        val presenter = ShopPresenter(store, { UUID.randomUUID().toString() }, System::currentTimeMillis)
        val crypto = JcaBackupCrypto()
        val secrets = AndroidSecretStore(this)
        val privateService = OrderPrivateService(store, secrets, crypto)
        val carrierSettings = CarrierSettings(secrets)
        val receiptService = ReceiptService(privateService, { UUID.randomUUID().toString() })
        val syncPackages = SyncPackageService(store, crypto)
        syncService = runCatching { TlsSyncService(store, secrets, crypto) }
            .getOrElse { UnavailableSyncService("Peer sync unavailable: ${it.message}") }
        val backup = BackupService(store, crypto, privateService)
        val backupFiles = AndroidBackupFiles(this)
        setContent {
            OmniShopApp(
                presenter, backup, privateService, receiptService, syncPackages, syncService, carrierSettings,
                listOf(ThailandPostAdapter()), backupFiles,
            ) { url ->
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        syncService.close()
        store.close()
    }
}
