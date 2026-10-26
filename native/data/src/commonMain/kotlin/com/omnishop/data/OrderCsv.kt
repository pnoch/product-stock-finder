package com.omnishop.data

import com.omnishop.core.*
import kotlin.time.Instant

data class OrderCsvPreview(val orders: List<PurchaseOrder>, val errors: List<String>)

/**
 * Parses the documented CSV order format. One row is one item; order-level
 * columns may be repeated or left blank on later rows, but conflicting values
 * are rejected. No database work happens here.
 */
class OrderCsvImporter(
    private val newId: () -> String,
) {
    private data class Draft(
        val merchant: String,
        val merchantOrderId: String,
        val items: MutableList<OrderItem> = mutableListOf(),
        var currency: Currency? = null,
        var purchasedAt: Long? = null,
        var shipping: Money? = null,
        var tax: Money? = null,
        var discount: Money? = null,
        var totalPaid: Money? = null,
        var paymentLabel: String? = null,
    )

    fun parse(bytes: ByteArray): OrderCsvPreview {
        val text = bytes.decodeToString().removePrefix("\uFEFF")
        val rows = runCatching { parseCsv(text) }.getOrElse {
            return OrderCsvPreview(emptyList(), listOf("CSV could not be read: ${it.message}"))
        }
        if (rows.isEmpty()) return OrderCsvPreview(emptyList(), listOf("CSV is empty"))
        val header = rows.first().map { it.trim().lowercase() }
        val required = listOf("merchant", "order_id", "currency", "item_title", "quantity")
        val missing = required.filter { it !in header }
        if (missing.isNotEmpty()) {
            return OrderCsvPreview(emptyList(), listOf("Missing columns: ${missing.joinToString(", ")}"))
        }
        fun column(row: List<String>, name: String): String =
            header.indexOf(name).takeIf { it >= 0 && it < row.size }?.let { row[it].trim() }.orEmpty()

        val drafts = linkedMapOf<String, Draft>()
        val errors = mutableListOf<String>()
        rows.drop(1).forEachIndexed { index, row ->
            val line = index + 2
            if (row.all { it.isBlank() }) return@forEachIndexed
            val merchant = column(row, "merchant")
            val orderId = column(row, "order_id")
            if (merchant.isBlank() || orderId.isBlank()) {
                errors += "Row $line: merchant and order_id are required"
                return@forEachIndexed
            }
            val key = "$merchant\u0000$orderId"
            val draft = drafts.getOrPut(key) { Draft(merchant, orderId) }
            val currencyCode = column(row, "currency").uppercase()
            val scaleText = column(row, "currency_scale")
            val scale = if (scaleText.isBlank()) 2 else scaleText.toIntOrNull()
            if (currencyCode.isNotBlank()) {
                if (scale == null || scale !in 0..4) {
                    errors += "Row $line: invalid currency_scale"
                    return@forEachIndexed
                }
                val parsed = runCatching { Currency(currencyCode, scale) }.getOrNull()
                if (parsed == null) {
                    errors += "Row $line: invalid currency"
                    return@forEachIndexed
                }
                if (draft.currency != null && draft.currency != parsed) {
                    errors += "Row $line: currency differs from the first row for this order"
                    return@forEachIndexed
                }
                draft.currency = parsed
            }
            val dateText = column(row, "purchased_at")
            if (dateText.isNotBlank()) {
                val parsed = parseDate(dateText)
                if (parsed == null) {
                    errors += "Row $line: purchased_at must be YYYY-MM-DD"
                    return@forEachIndexed
                }
                if (draft.purchasedAt != null && draft.purchasedAt != parsed) {
                    errors += "Row $line: purchased_at differs from the first row for this order"
                    return@forEachIndexed
                }
                draft.purchasedAt = parsed
            }
            fun amount(name: String): Money? {
                val raw = column(row, name)
                if (raw.isBlank()) return null
                val currency = draft.currency
                if (currency == null) {
                    errors += "Row $line: $name requires a currency"
                    return null
                }
                return runCatching { parseNonNegativeMoney(raw.replace(",", ""), currency) }.getOrElse {
                    errors += "Row $line: invalid $name"
                    null
                }
            }
            val shipping = amount("shipping")
            val tax = amount("tax")
            val discount = amount("discount")
            val total = amount("total")
            if (shipping != null) {
                if (draft.shipping != null && draft.shipping != shipping) errors += "Row $line: shipping differs for this order"
                else draft.shipping = shipping
            }
            if (tax != null) {
                if (draft.tax != null && draft.tax != tax) errors += "Row $line: tax differs for this order"
                else draft.tax = tax
            }
            if (discount != null) {
                if (draft.discount != null && draft.discount != discount) errors += "Row $line: discount differs for this order"
                else draft.discount = discount
            }
            if (total != null) {
                if (draft.totalPaid != null && draft.totalPaid != total) errors += "Row $line: total differs for this order"
                else draft.totalPaid = total
            }
            val payment = column(row, "payment_label")
            if (payment.isNotBlank()) {
                if (draft.paymentLabel != null && draft.paymentLabel != payment) errors += "Row $line: payment_label differs for this order"
                else draft.paymentLabel = payment
            }
            val title = column(row, "item_title")
            val quantity = column(row, "quantity").toIntOrNull()
            if (title.isBlank() || quantity == null || quantity <= 0) {
                errors += "Row $line: item_title and a positive quantity are required"
                return@forEachIndexed
            }
            val unitPrice = amount("unit_price")
            val item = runCatching { OrderItem(newId(), title, quantity, unitPrice) }.getOrElse {
                errors += "Row $line: invalid item"
                return@forEachIndexed
            }
            draft.items += item
        }

        if (errors.isNotEmpty()) return OrderCsvPreview(emptyList(), errors)
        val orders = drafts.values.mapNotNull { draft ->
            if (draft.items.isEmpty()) {
                errors += "${draft.merchant} / ${draft.merchantOrderId}: no items"
                return@mapNotNull null
            }
            runCatching {
                PurchaseOrder(
                    newId(), draft.merchant, draft.items.toList(), emptyList(), draft.currency,
                    draft.shipping, draft.tax, draft.discount, draft.totalPaid,
                    draft.merchantOrderId, draft.purchasedAt, draft.paymentLabel,
                )
            }.getOrElse {
                errors += "${draft.merchant} / ${draft.merchantOrderId}: ${it.message}"
                null
            }
        }
        return OrderCsvPreview(if (errors.isEmpty()) orders else emptyList(), errors)
    }

    private fun parseDate(value: String): Long? {
        if (!Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(value)) return null
        return runCatching { Instant.parse("${value}T00:00:00Z").toEpochMilliseconds() }.getOrNull()
    }

    private fun parseCsv(text: String): List<List<String>> {
        val rows = mutableListOf<MutableList<String>>()
        var row = mutableListOf<String>()
        val field = StringBuilder()
        var quoted = false
        var index = 0
        while (index < text.length) {
            val char = text[index]
            if (quoted) {
                if (char == '"') {
                    if (index + 1 < text.length && text[index + 1] == '"') {
                        field.append('"'); index++
                    } else quoted = false
                } else field.append(char)
            } else {
                when (char) {
                    '"' -> quoted = true
                    ',' -> { row.add(field.toString()); field.clear() }
                    '\n' -> { row.add(field.toString()); field.clear(); rows.add(row); row = mutableListOf() }
                    '\r' -> Unit
                    else -> field.append(char)
                }
            }
            index++
        }
        if (quoted) throw IllegalArgumentException("Unclosed quoted field")
        if (field.isNotEmpty() || row.isNotEmpty()) { row.add(field.toString()); rows.add(row) }
        return rows
    }
}
