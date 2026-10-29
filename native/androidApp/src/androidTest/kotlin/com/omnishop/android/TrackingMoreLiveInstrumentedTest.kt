package com.omnishop.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.omnishop.carriers.CarrierCredentials
import com.omnishop.carriers.CarrierResult
import com.omnishop.carriers.TrackingMoreAdapter
import com.omnishop.data.CarrierSettings
import com.omnishop.core.ShipmentStatus
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TrackingMoreLiveInstrumentedTest {
    @Test fun storesKeyAndTracksThailandPost() = runBlocking {
        val key = InstrumentationRegistry.getArguments().getString("trackingMoreKey")
            ?.takeIf { it.isNotBlank() } ?: return@runBlocking
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val settings = CarrierSettings(AndroidSecretStore(context))
        settings.setThailandPostApiKey(key)
        val stored = requireNotNull(settings.thailandPostApiKey())
        val result = TrackingMoreAdapter().track("JD282523205TH", CarrierCredentials(stored))
        val tracking = (result as? CarrierResult.Success)?.tracking
            ?: error("Live tracking failed: ${(result as? CarrierResult.Failure)?.failure?.message}")
        assertTrue(tracking.events.size >= 5)
        assertTrue(tracking.events.any { it.status == ShipmentStatus.DELIVERED })
    }
}
