package com.omnishop.data

/**
 * OS-backed secret storage. Implementations return a copy; callers own and may
 * zero the returned array. Unsupported platforms must throw rather than write
 * plaintext.
 */
interface SecretStore {
    fun get(key: String): ByteArray?
    fun set(key: String, value: ByteArray)
    fun delete(key: String)
}

data class PrivateRow(
    val orderId: String,
    val field: String,
    val keyVersion: Int,
    val nonce: ByteArray,
    val ciphertext: ByteArray,
)

data class PrivateValue(val orderId: String, val field: String, val value: String)
