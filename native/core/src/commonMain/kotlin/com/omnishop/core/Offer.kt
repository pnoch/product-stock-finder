package com.omnishop.core

data class Offer(
    val id: String,
    val productId: String,
    val sourceLabel: String,
    val estimate: CostEstimate,
) {
    init { require(id.isNotBlank() && productId.isNotBlank() && sourceLabel.isNotBlank()) }
}

fun parseNonNegativeMoney(text: String, currency: Currency): Money {
    val pattern = if (currency.scale == 0) Regex("[0-9]+") else Regex("[0-9]+(?:\\.[0-9]{1,${currency.scale}})?")
    require(pattern.matches(text)) { "Enter a non-negative amount with at most ${currency.scale} decimal places" }
    val parts = text.split('.')
    val digits = parts[0] + parts.getOrElse(1) { "" }.padEnd(currency.scale, '0')
    return Money(requireNotNull(digits.toLongOrNull()) { "Amount is too large" }, currency)
}

fun Money.decimalString(): String {
    val negative = minorUnits < 0
    val digits = minorUnits.toString().removePrefix("-").padStart(currency.scale + 1, '0')
    val amount = if (currency.scale == 0) digits else digits.dropLast(currency.scale) + "." + digits.takeLast(currency.scale)
    return (if (negative) "-" else "") + amount
}
