package com.omnishop.app

import androidx.compose.ui.window.ComposeUIViewController
import com.omnishop.carriers.ThailandPostAdapter
import com.omnishop.data.BackupService
import com.omnishop.data.CarrierSettings
import com.omnishop.data.ReceiptService
import com.omnishop.data.SyncPackageService
import com.omnishop.data.UnavailableSyncService
import com.omnishop.data.OrderPrivateService
import com.omnishop.data.openIosStore
import kotlinx.cinterop.ExperimentalForeignApi
import platform.Foundation.NSDate
import platform.Foundation.NSUUID
import platform.Foundation.timeIntervalSince1970
import platform.UIKit.UIViewController

@OptIn(ExperimentalForeignApi::class)
fun MainViewController(
    cryptoCallbacks: IosCryptoCallbacks,
    secretCallbacks: IosSecretCallbacks,
    backupCallbacks: IosBackupCallbacks,
    openUrl: (String) -> Unit,
): UIViewController {
    val store = openIosStore()
    val crypto = CallbackBackupCrypto(cryptoCallbacks)
    val secrets = CallbackSecretStore(secretCallbacks)
    val files = CallbackBackupFiles(backupCallbacks)
    val privateService = OrderPrivateService(store, secrets, crypto)
    val carrierSettings = CarrierSettings(secrets)
    val receiptService = ReceiptService(privateService, store, { NSUUID().UUIDString })
    val syncPackages = SyncPackageService(store, crypto, receiptService)
    val syncService = UnavailableSyncService()
    val backup = BackupService(store, crypto, privateService)
    val presenter = ShopPresenter(
        store,
        { NSUUID().UUIDString },
        { (NSDate().timeIntervalSince1970 * 1000).toLong() },
    )
    return ComposeUIViewController {
        OmniShopApp(
            presenter, backup, privateService, receiptService, syncPackages, syncService, carrierSettings,
            listOf(ThailandPostAdapter()), files, openUrl,
        )
    }
}
