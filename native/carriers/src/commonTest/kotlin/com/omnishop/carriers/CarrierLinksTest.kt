package com.omnishop.carriers

import kotlin.test.*

class CarrierLinksTest {
    @Test fun exposesTheSupportedLinkOnlyCarriers() {
        assertEquals(
            listOf("spx", "lex", "kex", "flash", "jnt", "ninjavan"),
            CarrierLinks.all.map { it.id },
        )
        assertTrue(CarrierLinks.byId("spx")!!.viaLookup)
        assertTrue(CarrierLinks.byId("lex")!!.viaLookup)
        assertFalse(CarrierLinks.byId("kex")!!.viaLookup)
        assertNull(CarrierLinks.byId("thailandpost"))
    }

    @Test fun buildsDirectCarrierTrackingLinks() {
        assertEquals("https://th.kex-express.com/th/track/?track=KEX12345678", CarrierLinks.trackingUrl("kex", " kex12345678 "))
        assertEquals("https://www.flashexpress.co.th/fle/tracking?se=TH12345678901", CarrierLinks.trackingUrl("flash", "TH12345678901"))
        assertEquals("https://www.jtexpress.co.th/service/track?waybillNo=JT123456789", CarrierLinks.trackingUrl("jnt", "JT123456789"))
        assertEquals("https://www.ninjavan.co/th-th/tracking?id=NVTH123456", CarrierLinks.trackingUrl("ninjavan", "NVTH123456"))
    }

    @Test fun usesAClearlyThirdPartyLookupForSpxAndLex() {
        assertEquals("https://www.17track.net/en/track?nums=SPXTH1234567890", CarrierLinks.trackingUrl("spx", "SPXTH1234567890"))
        assertEquals("https://www.17track.net/en/track?nums=LEX12345678", CarrierLinks.trackingUrl("lex", "LEX12345678"))
    }

    @Test fun rejectsUnknownCarriersAndUnsafeTrackingNumbers() {
        assertNull(CarrierLinks.trackingUrl("unknown", "ABC12345"))
        assertNull(CarrierLinks.trackingUrl("kex", "KEX 123 456"))
        assertNull(CarrierLinks.trackingUrl("kex", "KEX/123"))
        assertNull(CarrierLinks.trackingUrl("kex", "abc"))
        assertNull(CarrierLinks.trackingUrl("kex", "A".repeat(41)))
    }
}
