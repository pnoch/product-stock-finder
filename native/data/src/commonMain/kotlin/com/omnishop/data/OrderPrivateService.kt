package com.omnishop.data

import com.omnishop.data.security.BackupCrypto

class OrderPrivateService(
    private val store: ShoppingStore,
    private val secrets: SecretStore,
    private val crypto: BackupCrypto,
    private val keyVersion: Int = 1,
) {
    fun save(orderId: String, field: String, value: String) {
        require(field.isNotBlank() && field.length <= 64) { "Invalid private-field name" }
        require(value.length <= MAX_VALUE_LENGTH) { "Value is too long" }
        requireNotNull(store.getOrder(orderId)) { "Order not found" }
        if (value.isBlank()) {
            store.deletePrivate(orderId, field)
            return
        }
        val key = localKey()
        try {
            val nonce = crypto.randomBytes(NONCE_BYTES)
            val ciphertext = crypto.seal(key, nonce, aad(orderId, field), value.encodeToByteArray())
            store.upsertPrivate(PrivateRow(orderId, field, keyVersion, nonce, ciphertext))
        } finally {
            key.fill(0)
        }
    }

    fun read(orderId: String, field: String): String? {
        val row = store.privateField(orderId, field) ?: return null
        require(row.keyVersion == keyVersion) { "Private field was encrypted with an unsupported key version" }
        val key = localKey()
        try {
            val plaintext = crypto.open(key, row.nonce, aad(orderId, field), row.ciphertext)
                ?: throw com.omnishop.data.security.BackupAuthenticationException()
            return plaintext.decodeToString()
        } finally {
            key.fill(0)
        }
    }

    fun exportAll(): List<PrivateValue> {
        val rows = store.privateFields()
        if (rows.isEmpty()) return emptyList()
        val key = localKey()
        try {
            return rows.map {
                require(it.keyVersion == keyVersion) { "Unsupported private-field key version" }
                val plaintext = crypto.open(key, it.nonce, aad(it.orderId, it.field), it.ciphertext)
                    ?: throw com.omnishop.data.security.BackupAuthenticationException()
                PrivateValue(it.orderId, it.field, plaintext.decodeToString())
            }
        } finally {
            key.fill(0)
        }
    }

    fun encryptForRestore(values: List<PrivateValue>): List<PrivateRow> {
        if (values.isEmpty()) return emptyList()
        val key = localKey()
        try {
            return values.map {
                val nonce = crypto.randomBytes(NONCE_BYTES)
                PrivateRow(it.orderId, it.field, keyVersion, nonce,
                    crypto.seal(key, nonce, aad(it.orderId, it.field), it.value.encodeToByteArray()))
            }
        } finally {
            key.fill(0)
        }
    }

    private fun localKey(): ByteArray {
        secrets.get(DEK_KEY)?.let {
            require(it.size == KEY_BYTES) { "Stored device key is invalid" }
            return it
        }
        val created = crypto.randomBytes(KEY_BYTES)
        secrets.set(DEK_KEY, created)
        return created
    }

    private fun aad(orderId: String, field: String) =
        "omnishop-order-private-v1\u0000$orderId\u0000$field".encodeToByteArray()

    companion object {
        const val SHIPPING_ADDRESS = "shipping_address"
        const val MAX_VALUE_LENGTH = 12_000_000
        private const val DEK_KEY = "device.dek.v1"
        private const val KEY_BYTES = 32
        private const val NONCE_BYTES = 12
    }
}
