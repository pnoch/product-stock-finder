package com.omnishop.data

/** Device-local carrier credentials. Values are held by the platform SecretStore. */
class CarrierSettings(private val secrets: SecretStore) {
    fun thailandPostApiKey(): String? =
        secrets.get(THAILAND_POST_KEY)?.decodeToString()?.takeIf { it.isNotBlank() }

    fun setThailandPostApiKey(value: String) {
        val trimmed = value.trim()
        require(trimmed.isNotBlank() && trimmed.length <= 512) { "Enter a valid Thailand Post API key" }
        secrets.set(THAILAND_POST_KEY, trimmed.encodeToByteArray())
    }

    fun clearThailandPostApiKey() {
        secrets.delete(THAILAND_POST_KEY)
    }

    fun isThailandPostConfigured(): Boolean = thailandPostApiKey() != null

    companion object {
        const val THAILAND_POST = "thailandpost"
        private const val THAILAND_POST_KEY = "carrier.thailandpost.apiKey"
    }
}
