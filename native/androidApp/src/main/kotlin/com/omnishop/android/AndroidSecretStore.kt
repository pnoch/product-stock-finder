package com.omnishop.android

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.omnishop.data.SecretStore
import java.security.KeyStore
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Stores a device key encrypted by a non-exportable Android Keystore key. */
class AndroidSecretStore(context: Context) : SecretStore {
    private val prefs = context.applicationContext.getSharedPreferences("omnishop_secrets", Context.MODE_PRIVATE)

    override fun get(key: String): ByteArray? = synchronized(this) {
        val encoded = prefs.getString(key, null) ?: return null
        val combined = Base64.getDecoder().decode(encoded)
        require(combined.size > NONCE_BYTES) { "Stored secret is invalid" }
        val nonce = combined.copyOfRange(0, NONCE_BYTES)
        val ciphertext = combined.copyOfRange(NONCE_BYTES, combined.size)
        Cipher.getInstance("AES/GCM/NoPadding").run {
            init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, nonce))
            doFinal(ciphertext)
        }
    }

    override fun set(key: String, value: ByteArray) = synchronized(this) {
        // Android Keystore owns the IV for randomized AES-GCM keys and rejects
        // a caller-supplied one; take the IV the Cipher generated instead.
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val nonce = cipher.iv
        val ciphertext = cipher.doFinal(value)
        prefs.edit().putString(key, Base64.getEncoder().encodeToString(nonce + ciphertext)).apply()
    }

    override fun delete(key: String) {
        prefs.edit().remove(key).apply()
    }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build())
            generateKey()
        }
    }

    private companion object {
        const val ALIAS = "omnishop.device-key.v1"
        const val NONCE_BYTES = 12
    }
}
