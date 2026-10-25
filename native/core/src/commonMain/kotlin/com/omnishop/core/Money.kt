package com.omnishop.core

data class Currency(val code: String, val scale: Int) {
    init {
        require(code.matches(Regex("[A-Z]{3}"))) { "Expected an uppercase ISO currency code" }
        require(scale in 0..4) { "Currency scale must be between zero and four" }
    }

    companion object {
        val THB = Currency("THB", 2)
        val USD = Currency("USD", 2)
    }
}

data class Money(val minorUnits: Long, val currency: Currency) {
    operator fun plus(other: Money): Money {
        require(currency == other.currency) { "Convert currencies explicitly before adding" }
        val b = other.minorUnits
        require(!(b > 0 && minorUnits > Long.MAX_VALUE - b)) { "Money overflow" }
        require(!(b < 0 && minorUnits < Long.MIN_VALUE - b)) { "Money overflow" }
        return copy(minorUnits = minorUnits + b)
    }

    operator fun minus(other: Money): Money {
        require(currency == other.currency) { "Convert currencies explicitly before subtracting" }
        val b = other.minorUnits
        require(!(b > 0 && minorUnits < Long.MIN_VALUE + b)) { "Money overflow" }
        require(!(b < 0 && minorUnits > Long.MAX_VALUE + b)) { "Money overflow" }
        return copy(minorUnits = minorUnits - b)
    }
}
