package com.omnishop.carriers

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertIs
import kotlin.test.assertTrue

class TrackingMoreLiveTest {
    @Test fun mapsLiveThailandPostShipment() = runBlocking {
        val key = System.getenv("TRACKINGMORE_API_KEY")?.takeIf { it.isNotBlank() } ?: return@runBlocking
        val result = TrackingMoreAdapter().track("JD282523205TH", CarrierCredentials(key))
        if (result is CarrierResult.Failure) error("live failure: ${result.failure.problem}: ${result.failure.message}")
        val tracking = assertIs<CarrierResult.Success>(result).tracking
        assertTrue(tracking.events.size >= 5)
        assertTrue(tracking.events.any { it.description.contains("Successful delivery") })
    }
}
