package com.omnishop.android

import android.content.Intent
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import com.omnishop.app.OmniShopApp
import com.omnishop.app.ShopPresenter
import com.omnishop.carriers.TrackingMoreAdapter
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
    private var multicastLock: WifiManager.MulticastLock? = null
    private var pendingScan: ((String) -> Unit)? = null
    private val scanLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val code = result.data?.getStringExtra(ScanQrActivity.EXTRA_CODE)
        if (result.resultCode == RESULT_OK && code != null) {
            pendingScan?.invoke(code)
        } else {
            result.data?.getStringExtra(ScanQrActivity.EXTRA_ERROR)?.let {
                Toast.makeText(this, it, Toast.LENGTH_LONG).show()
            }
        }
        pendingScan = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SyncWorkScheduler.schedule(applicationContext)
        val wifi = applicationContext.getSystemService(WIFI_SERVICE) as? WifiManager
        multicastLock = wifi?.createMulticastLock("omnishop-mdns")?.apply {
            setReferenceCounted(false)
            acquire()
        }
        store = ShoppingStore.openAndroid(applicationContext)
        val presenter = ShopPresenter(store, { UUID.randomUUID().toString() }, System::currentTimeMillis)
        val crypto = JcaBackupCrypto()
        val secrets = AndroidSecretStore(this)
        val privateService = OrderPrivateService(store, secrets, crypto)
        val carrierSettings = CarrierSettings(secrets)
        val receiptService = ReceiptService(privateService, store, { UUID.randomUUID().toString() })
        val syncPackages = SyncPackageService(store, crypto, receiptService)
        syncService = runCatching { TlsSyncService(store, secrets, crypto, receiptService, displayName = "Android") }
            .getOrElse { UnavailableSyncService("Peer sync unavailable: ${it.message}") }
        val backup = BackupService(store, crypto, privateService)
        val backupFiles = AndroidBackupFiles(this)
        val scanPairingCode: (((String) -> Unit) -> Unit) = { callback ->
            pendingScan = callback
            scanLauncher.launch(Intent(this, ScanQrActivity::class.java))
        }
        setContent {
            OmniShopApp(
                presenter, backup, privateService, receiptService, syncPackages, syncService, carrierSettings,
                listOf(TrackingMoreAdapter()), backupFiles, scanPairingCode,
            ) { url ->
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        multicastLock?.release()
        syncService.close()
        store.close()
    }
}
