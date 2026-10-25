package com.omnishop.core

enum class Capability {
    SUPPORTED, REQUIRES_AUTHORIZATION, REQUIRES_DEVELOPER_APPROVAL, LINK_IMPORT_ONLY,
    EXTERNAL_SEARCH_ONLY, UNSUPPORTED,
}

enum class ConnectionHealth { NOT_CHECKED, AVAILABLE, TEMPORARILY_UNAVAILABLE }

data class SourceCapabilities(val id: String, val search: Capability, val importUrl: Capability) {
    init { require(id.isNotBlank()) }
}

object ShoppingSources {
    val facebook = SourceCapabilities("facebook-marketplace", Capability.EXTERNAL_SEARCH_ONLY, Capability.LINK_IMPORT_ONLY)
    val shopee = SourceCapabilities("shopee", Capability.EXTERNAL_SEARCH_ONLY, Capability.LINK_IMPORT_ONLY)
    val lazada = SourceCapabilities("lazada", Capability.EXTERNAL_SEARCH_ONLY, Capability.LINK_IMPORT_ONLY)
    val ebay = SourceCapabilities("ebay", Capability.EXTERNAL_SEARCH_ONLY, Capability.LINK_IMPORT_ONLY)
    val initial = listOf(facebook, shopee, lazada, ebay)
}
