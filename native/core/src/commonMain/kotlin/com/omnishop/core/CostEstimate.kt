package com.omnishop.core

sealed interface Cost {
    data class Known(val amount: Money) : Cost
    data object Unknown : Cost
}

enum class CostPart { SHIPPING, TAXES, FEES }

data class CostEstimate(
    val itemPrice: Money,
    val shipping: Cost = Cost.Unknown,
    val taxes: Cost = Cost.Unknown,
    val fees: Cost = Cost.Unknown,
    val discount: Money = Money(0, itemPrice.currency),
) {
    private val parts = mapOf(CostPart.SHIPPING to shipping, CostPart.TAXES to taxes, CostPart.FEES to fees)

    init {
        require(itemPrice.minorUnits >= 0) { "Item price cannot be negative" }
        require(discount.currency == itemPrice.currency && discount.minorUnits >= 0)
        parts.values.filterIsInstance<Cost.Known>().forEach {
            require(it.amount.currency == itemPrice.currency) { "Costs must use the item currency" }
            require(it.amount.minorUnits >= 0) { "Costs cannot be negative" }
        }
    }

    val unknownParts: Set<CostPart> get() = parts.filterValues { it == Cost.Unknown }.keys

    val total: Money?
        get() {
            if (unknownParts.isNotEmpty()) return null
            val gross = parts.values.filterIsInstance<Cost.Known>()
                .fold(itemPrice) { sum, cost -> sum + cost.amount }
            require(discount.minorUnits <= gross.minorUnits) { "Discount exceeds the total" }
            return gross - discount
        }
}
