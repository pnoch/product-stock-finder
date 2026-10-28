package com.omnishop.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DevicesPairingUiTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    @Test fun pairsAndSyncsFromDevicesUi() {
        val code = InstrumentationRegistry.getArguments().getString("pairingCode")
            ?: error("Pass the pairing code with -e pairingCode <code>")

        rule.onNodeWithText("Profile").performClick()
        val joinField = rule.onNode(hasSetTextAction() and hasText("Join with a code"))
        joinField.performScrollTo().performTextReplacement(code)
        joinField.assertTextContains(code)
        rule.onNodeWithText("Pair").performScrollTo().assertIsEnabled().performClick()
        rule.waitUntil(30_000) {
            rule.onAllNodesWithText("Device paired.", substring = true).fetchSemanticsNodes().isNotEmpty() ||
                rule.onAllNodesWithText("Pairing failed", substring = true).fetchSemanticsNodes().isNotEmpty()
        }
        rule.onNodeWithText("Pairing failed", substring = true).assertDoesNotExist()
        rule.onNodeWithText("Sync now").performScrollTo().performClick()
        rule.waitUntil(30_000) {
            rule.onAllNodesWithText("Sync complete. Applied:", substring = true).fetchSemanticsNodes().isNotEmpty()
        }
        rule.onNodeWithText("Saved").performClick()
        rule.waitUntil(10_000) {
            rule.onAllNodesWithText("HARNESS DESKTOP PRODUCT", substring = true).fetchSemanticsNodes().isNotEmpty()
        }
        rule.onNodeWithText("HARNESS DESKTOP PRODUCT", substring = true).assertIsDisplayed()
    }
}
