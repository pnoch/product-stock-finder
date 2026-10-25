package com.omnishop.connectors

import io.ktor.http.URLBuilder
import io.ktor.http.URLProtocol
import io.ktor.http.Url
import io.ktor.http.takeFrom

fun validatedBookmarkUrl(raw: String): String {
    require(raw.length <= 4096 && raw.none { it.isWhitespace() || it.code < 32 }) { "Invalid product URL" }
    val url = Url(raw)
    require(url.protocol == URLProtocol.HTTPS && url.host.isNotBlank()) { "Use an HTTPS product URL" }
    require(url.user == null && url.password == null && url.port == 443) { "Credentials and custom ports are not supported" }
    val host = url.host.lowercase()
    require(host != "localhost" && !host.endsWith(".localhost") && !host.endsWith(".local")) { "Local addresses are not supported" }
    require(!host.contains(':') && !host.all { it.isDigit() || it == '.' }) { "IP address links are not supported" }
    return url.toString()
}

fun externalSearchUrl(sourceId: String, keywords: String): String {
    require(keywords.isNotBlank() && keywords.length <= 500) { "Enter search keywords" }
    val (base, parameter) = when (sourceId) {
        "facebook-marketplace" -> "https://www.facebook.com/marketplace/search/" to "query"
        "shopee" -> "https://shopee.co.th/search" to "keyword"
        "lazada" -> "https://www.lazada.co.th/catalog/" to "q"
        "ebay" -> "https://www.ebay.com/sch/i.html" to "_nkw"
        else -> throw IllegalArgumentException("Unsupported search source")
    }
    return URLBuilder().apply {
        takeFrom(base)
        parameters.append(parameter, keywords.trim())
    }.buildString()
}
