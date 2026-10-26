package com.omnishop.carriers

data class ThaiPostTimestamp(val epochMillis: Long, val offset: String)

private val TIMESTAMP_PATTERN =
    Regex("""(\d{2})/(\d{2})/(\d{4}) (\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})""")

/**
 * Parses Thailand Post's Buddhist-era timestamp (`dd/MM/yyyy HH:mm:ss±HH:MM`)
 * without assuming the device timezone. Returns null when the timestamp does
 * not include a resolvable offset; callers keep the original text and leave the
 * instant unknown rather than guessing.
 */
fun parseThaiPostTimestamp(value: String): ThaiPostTimestamp? {
    val parts = TIMESTAMP_PATTERN.matchEntire(value.trim())?.destructured ?: return null
    val (dayText, monthText, yearText, hourText, minuteText, secondText, offset) = parts
    val day = dayText.toIntOrNull() ?: return null
    val month = monthText.toIntOrNull() ?: return null
    val year = (yearText.toIntOrNull() ?: return null) - 543
    val hour = hourText.toIntOrNull() ?: return null
    val minute = minuteText.toIntOrNull() ?: return null
    val second = secondText.toIntOrNull() ?: return null
    if (year !in 1900..2100 || month !in 1..12 || day !in 1..daysInMonth(year, month)) return null
    if (hour !in 0..23 || minute !in 0..59 || second !in 0..59) return null
    val offsetSeconds = parseOffset(offset) ?: return null
    val epochSeconds = daysFromCivil(year, month, day) * 86_400L +
        hour * 3_600L + minute * 60L + second - offsetSeconds
    return ThaiPostTimestamp(epochSeconds * 1_000L, offset)
}

private fun parseOffset(value: String): Int? {
    val match = Regex("""([+-])(\d{2}):(\d{2})""").matchEntire(value) ?: return null
    val (sign, hours, minutes) = match.destructured
    val hour = hours.toIntOrNull() ?: return null
    val minute = minutes.toIntOrNull() ?: return null
    if (hour > 14 || minute > 59) return null
    val seconds = hour * 3_600 + minute * 60
    return if (sign == "-") -seconds else seconds
}

private fun daysInMonth(year: Int, month: Int): Int = when (month) {
    2 -> if (isLeapYear(year)) 29 else 28
    4, 6, 9, 11 -> 30
    else -> 31
}

private fun isLeapYear(year: Int): Boolean =
    year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)

private fun daysFromCivil(year: Int, month: Int, day: Int): Long {
    var y = year
    if (month <= 2) y -= 1
    val era = if (y >= 0) y / 400 else (y - 399) / 400
    val yearOfEra = y - era * 400
    val monthPrime = if (month > 2) month - 3 else month + 9
    val dayOfYear = (153 * monthPrime + 2) / 5 + day - 1
    val dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear
    return era * 146_097L + dayOfEra - 719_468L
}
