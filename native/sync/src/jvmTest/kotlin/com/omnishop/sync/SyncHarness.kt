package com.omnishop.sync

import com.omnishop.data.SavedProduct
import com.omnishop.data.SecretStore
import com.omnishop.data.ShoppingStore
import com.omnishop.data.inMemory
import com.omnishop.data.security.JcaBackupCrypto
import kotlinx.coroutines.runBlocking
import java.io.File

private class HarnessSecrets : SecretStore {
    private val values = mutableMapOf<String, ByteArray>()
    override fun get(key: String): ByteArray? = values[key]?.copyOf()
    override fun set(key: String, value: ByteArray) { values[key] = value.copyOf() }
    override fun delete(key: String) { values.remove(key) }
}

fun main() {
    val store = ShoppingStore.inMemory("desktop-harness")
    store.saveProduct(SavedProduct("harness-product", "HARNESS DESKTOP PRODUCT", null, System.currentTimeMillis()))
    val service = TlsSyncService(store, HarnessSecrets(), JcaBackupCrypto(), enableDiscovery = false, port = 8790, advertisedHost = "127.0.0.1")
    val code = runBlocking { service.createPairing() }
    File("/tmp/opencode/omnishop-sync-code.txt").writeText(code.code)
    println("PAIRING_READY")
    val deadline = System.currentTimeMillis() + 180_000
    while (System.currentTimeMillis() < deadline && service.peers().isEmpty()) Thread.sleep(1_000)
    println("PEERS=${service.peers().map { it.displayName }}")
    Thread.sleep(30_000)
    println("PRODUCTS=${store.listProducts().map { it.title }}")
    service.close()
    store.close()
}
