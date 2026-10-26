package com.omnishop.data

class InMemorySecretStore : SecretStore {
    private val values = mutableMapOf<String, ByteArray>()
    override fun get(key: String): ByteArray? = values[key]?.copyOf()
    override fun set(key: String, value: ByteArray) { values[key] = value.copyOf() }
    override fun delete(key: String) { values.remove(key) }
}
