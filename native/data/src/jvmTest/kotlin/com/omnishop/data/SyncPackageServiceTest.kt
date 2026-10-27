package com.omnishop.data

import com.omnishop.core.*
import com.omnishop.data.security.BackupAuthenticationException
import com.omnishop.data.security.BackupFormatException
import com.omnishop.data.security.EncryptedBackup
import com.omnishop.data.security.JcaBackupCrypto
import kotlin.test.*

class SyncPackageServiceTest {
    private val crypto = JcaBackupCrypto()
    private val password = "sync password".toCharArray()

    private fun seed(store: ShoppingStore) {
        store.setPreference("language", "THAI")
        store.saveProduct(SavedProduct("p", "Tablet", "https://example.com/tablet", 90))
        store.saveOffer(Offer("l", "p", "Seller", CostEstimate(Money(800_000, Currency.THB))), 95)
        store.createOrder(PurchaseOrder(
            "o", "Shop", listOf(OrderItem("i", "Tablet", 1, Money(10_000, Currency.THB))),
            currency = Currency.THB, totalPaid = Money(10_000, Currency.THB), merchantOrderId = "M1",
        ), 100)
    }

    @Test fun mergesAllCollectionsAndIsIdempotent() {
        ShoppingStore.inMemory("a") { 100 }.use { a ->
            ShoppingStore.inMemory("b") { 200 }.use { b ->
                seed(a)
                val packageBytes = SyncPackageService(a, crypto) { 300 }.export(password)
                val service = SyncPackageService(b, crypto) { 400 }
                assertEquals(3, service.import(packageBytes, password))
                assertEquals("THAI", b.preference("language"))
                assertEquals("Tablet", b.listProducts().single().title)
                assertEquals("M1", b.getOrder("o")!!.merchantOrderId)
                assertEquals(0, service.import(packageBytes, password))
            }
        }
    }

    @Test fun keepsNewerLocalRecordsAndRejectsBadPackages() {
        ShoppingStore.inMemory("a") { 100 }.use { a ->
            ShoppingStore.inMemory("b") { 200 }.use { b ->
                a.setPreference("language", "THAI")
                val packageBytes = SyncPackageService(a, crypto) { 300 }.export(password)
                b.setPreference("language", "ENGLISH")
                assertEquals(0, SyncPackageService(b, crypto) { 400 }.import(packageBytes, password))
                assertEquals("ENGLISH", b.preference("language"))

                assertFailsWith<BackupAuthenticationException> {
                    SyncPackageService(b, crypto) { 400 }.import(packageBytes, "wrong password".toCharArray())
                }
                val invalid = EncryptedBackup.encrypt("{}".encodeToByteArray(), password, 500, crypto)
                assertFailsWith<BackupFormatException> {
                    SyncPackageService(b, crypto) { 500 }.import(invalid, password)
                }
            }
        }
    }

    @Test fun rejectsShortExportPasswords() {
        ShoppingStore.inMemory().use { store ->
            assertFailsWith<IllegalArgumentException> {
                SyncPackageService(store, crypto).export("short".toCharArray())
            }
        }
    }
}
