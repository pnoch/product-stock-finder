package com.omnishop.carriers

/**
 * Carriers that can be chosen without an authorized tracking API.
 *
 * [viaLookup] marks a third-party lookup page (17TRACK) because the carrier does
 * not offer a stable public deep link; the UI must label that clearly. These are
 * not API integrations and must never be presented as live carrier data.
 */
data class CarrierLink(
    val id: String,
    val displayName: String,
    val viaLookup: Boolean,
)

object CarrierLinks {
    private val TRACKING_NUMBER = Regex("^[A-Za-z0-9-]{4,40}$")

    val all: List<CarrierLink> = listOf(
        CarrierLink("spx", "SPX Express", viaLookup = true),
        CarrierLink("lex", "LEX (Lazada)", viaLookup = true),
        CarrierLink("kex", "KEX / Kerry Express", viaLookup = false),
        CarrierLink("flash", "Flash Express", viaLookup = false),
        CarrierLink("jnt", "J&T Express", viaLookup = false),
        CarrierLink("ninjavan", "Ninja Van", viaLookup = false),
    )

    fun byId(id: String?): CarrierLink? = all.firstOrNull { it.id == id }

    fun trackingUrl(id: String, trackingNumber: String): String? {
        val number = trackingNumber.trim().uppercase()
        if (!TRACKING_NUMBER.matches(number)) return null
        return when (id) {
            "spx", "lex" -> "https://www.17track.net/en/track?nums=$number"
            "kex" -> "https://th.kex-express.com/th/track/?track=$number"
            "flash" -> "https://www.flashexpress.co.th/fle/tracking?se=$number"
            "jnt" -> "https://www.jtexpress.co.th/service/track?waybillNo=$number"
            "ninjavan" -> "https://www.ninjavan.co/th-th/tracking?id=$number"
            else -> null
        }
    }
}
