package com.omnishop.desktop

import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import androidx.compose.ui.unit.dp
import com.omnishop.app.OmniShopApp
import com.omnishop.app.ShopPresenter
import com.omnishop.carriers.ThailandPostAdapter
import com.omnishop.data.BackupService
import com.omnishop.data.CarrierSettings
import com.omnishop.data.ReceiptService
import com.omnishop.data.SyncPackageService
import com.omnishop.data.OrderPrivateService
import com.omnishop.data.security.JcaBackupCrypto
import com.omnishop.connectors.validatedBookmarkUrl
import com.omnishop.data.ShoppingStore
import com.omnishop.data.open
import java.awt.Desktop
import java.io.File
import java.net.URI
import java.util.UUID
import com.omnishop.app.resources.Res
import com.omnishop.app.resources.omnishop
import org.jetbrains.compose.resources.painterResource

fun main() {
    val root = when {
        System.getProperty("os.name").startsWith("Windows") -> File(System.getenv("LOCALAPPDATA") ?: System.getProperty("user.home"), "OmniShopNative")
        System.getProperty("os.name").startsWith("Mac") -> File(System.getProperty("user.home"), "Library/Application Support/OmniShopNative")
        else -> File(System.getenv("XDG_DATA_HOME") ?: "${System.getProperty("user.home")}/.local/share", "omnishop-native")
    }
    check(root.isDirectory || root.mkdirs()) { "Cannot create OmniShop's data directory" }
    ShoppingStore.open(File(root, "omnishop.db")).use { store ->
        val presenter = ShopPresenter(store, { UUID.randomUUID().toString() }, System::currentTimeMillis)
        val crypto = JcaBackupCrypto()
        val secrets = KeyringSecretStore()
        val privateService = OrderPrivateService(store, secrets, crypto)
        val carrierSettings = CarrierSettings(secrets)
        val receiptService = ReceiptService(privateService, { UUID.randomUUID().toString() })
        val syncPackages = SyncPackageService(store, crypto)
        val backup = BackupService(store, crypto, privateService)
        application {
            Window(onCloseRequest = ::exitApplication, title = "OmniShop Native Preview",
                state = rememberWindowState(width = 1100.dp, height = 780.dp),
                icon = painterResource(Res.drawable.omnishop)) {
                OmniShopApp(
                    presenter, backup, privateService, receiptService, syncPackages, carrierSettings,
                    listOf(ThailandPostAdapter()), DesktopBackupFiles(),
                ) {
                    Desktop.getDesktop().browse(URI(validatedBookmarkUrl(it)))
                }
            }
        }
    }
}
