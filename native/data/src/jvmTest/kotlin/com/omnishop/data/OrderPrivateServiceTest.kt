package com.omnishop.data

import com.omnishop.core.*
import com.omnishop.data.security.BackupAuthenticationException
import com.omnishop.data.security.JcaBackupCrypto
import kotlin.test.*

class OrderPrivateServiceTest {
    private val crypto = JcaBackupCrypto()
    private val order = PurchaseOrder("o", "Shop", listOf(OrderItem("i", "Tablet", 1)))

    private fun storeWithOrder() = ShoppingStore.inMemory().also {
        it.createOrder(order, 100)
    }

    @Test fun savesReadsAndDeletesEncryptedAddress() {
        storeWithOrder().use { store ->
            val service = OrderPrivateService(store, InMemorySecretStore(), crypto)
            assertNull(service.read("o", OrderPrivateService.SHIPPING_ADDRESS))
            service.save("o", OrderPrivateService.SHIPPING_ADDRESS, "123 Secret Road")
            assertEquals("123 Secret Road", service.read("o", OrderPrivateService.SHIPPING_ADDRESS))
            val row = store.privateField("o", OrderPrivateService.SHIPPING_ADDRESS)!!
            assertFalse(row.ciphertext.decodeToString().contains("123 Secret Road"))
            service.save("o", OrderPrivateService.SHIPPING_ADDRESS, "")
            assertNull(service.read("o", OrderPrivateService.SHIPPING_ADDRESS))
        }
    }

    @Test fun rejectsMissingOrderAndUnknownKeyVersion() {
        storeWithOrder().use { store ->
            val service = OrderPrivateService(store, InMemorySecretStore(), crypto)
            assertFailsWith<IllegalArgumentException> {
                service.save("missing", OrderPrivateService.SHIPPING_ADDRESS, "x")
            }
            store.upsertPrivate(PrivateRow("o", OrderPrivateService.SHIPPING_ADDRESS, 2, ByteArray(12), ByteArray(16)))
            assertFailsWith<IllegalArgumentException> {
                service.read("o", OrderPrivateService.SHIPPING_ADDRESS)
            }
        }
    }

    @Test fun aDifferentDeviceKeyCannotReadTheCiphertext() {
        storeWithOrder().use { store ->
            OrderPrivateService(store, InMemorySecretStore(), crypto)
                .save("o", OrderPrivateService.SHIPPING_ADDRESS, "123 Secret Road")
            val otherDevice = OrderPrivateService(store, InMemorySecretStore(), crypto)
            assertFailsWith<BackupAuthenticationException> {
                otherDevice.read("o", OrderPrivateService.SHIPPING_ADDRESS)
            }
        }
    }

    @Test fun exportAndRestoreRoundTripThroughPlainValues() {
        storeWithOrder().use { source ->
            val sourceService = OrderPrivateService(source, InMemorySecretStore(), crypto)
            sourceService.save("o", OrderPrivateService.SHIPPING_ADDRESS, "123 Secret Road")
            assertEquals(listOf(PrivateValue("o", OrderPrivateService.SHIPPING_ADDRESS, "123 Secret Road")),
                sourceService.exportAll())

            storeWithOrder().use { target ->
                val targetService = OrderPrivateService(target, InMemorySecretStore(), crypto)
                val rows = targetService.encryptForRestore(sourceService.exportAll())
                target.replaceAll(source.snapshot(), rows)
                assertEquals("123 Secret Road", targetService.read("o", OrderPrivateService.SHIPPING_ADDRESS))
            }
        }
    }
}
