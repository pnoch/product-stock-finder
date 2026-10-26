package com.omnishop.desktop

import com.github.javakeyring.Keyring
import com.omnishop.data.SecretStore
import java.util.Base64

/**
 * Uses the OS credential store (Windows Credential Manager, macOS Keychain,
 * Linux Secret Service). Creation is lazy so the app still starts on a headless
 * development machine; sensitive operations then fail with a clear error
 * instead of falling back to a plaintext file.
 */
class KeyringSecretStore(
    private val service: String = "OmniShopNative",
    private val account: String = "device-key",
) : SecretStore {
    private val keyring by lazy { Keyring.create() }

    override fun get(key: String): ByteArray? =
        keyring.getPassword(service, "$account:$key")?.let { Base64.getDecoder().decode(it) }

    override fun set(key: String, value: ByteArray) {
        keyring.setPassword(service, "$account:$key", Base64.getEncoder().encodeToString(value))
    }

    override fun delete(key: String) {
        runCatching { keyring.deletePassword(service, "$account:$key") }
    }
}
