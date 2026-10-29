package com.omnishop.android

import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.omnishop.core.OrderItem
import com.omnishop.core.PurchaseOrder
import com.omnishop.core.Shipment
import com.omnishop.core.ShipmentAllocation
import com.omnishop.data.CarrierSettings
import com.omnishop.data.ShoppingStore
import com.omnishop.data.openAndroid
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TrackingMoreLiveUiTest {
    @get:Rule val rule = createEmptyComposeRule()

    @Test fun refreshRendersLiveDeliveredEvent() {
        val key = InstrumentationRegistry.getArguments().getString("trackingMoreKey")
            ?.takeIf { it.isNotBlank() } ?: return
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        CarrierSettings(AndroidSecretStore(context)).setThailandPostApiKey(key)
        val suffix = System.currentTimeMillis().toString()
        val orderId = "live-order-$suffix"
        val itemId = "live-item-$suffix"
        val shipmentId = "live-ship-$suffix"
        ShoppingStore.openAndroid(context).use { store ->
            store.createOrder(
                PurchaseOrder(orderId, "Live tracking $suffix", listOf(OrderItem(itemId, "Live item", 1))),
                System.currentTimeMillis(),
            )
            store.attachShipment(
                orderId,
                Shipment(shipmentId, listOf(ShipmentAllocation(itemId, 1)), carrierId = "thailandpost"),
                "JD282523205TH",
                "Thailand Post",
                "thailandpost",
            )
        }
        ActivityScenario.launch(MainActivity::class.java).use {
            rule.onNodeWithText("Orders").performClick()
            rule.onNodeWithText("Live tracking $suffix", substring = true).performScrollTo().performClick()
            rule.waitForIdle()
            rule.onNode(hasScrollAction() and hasScrollToIndexAction()).performScrollToNode(hasText("Refresh tracking", substring = true))
            rule.onNodeWithText("Refresh tracking", substring = true).performClick()
            rule.waitUntil(30_000) {
                rule.onAllNodesWithText("Successful delivery", substring = true)
                    .fetchSemanticsNodes().isNotEmpty()
            }
        }
    }
}
