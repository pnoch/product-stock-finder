package com.omnishop.android

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ProfilePanelsSmokeTest {
    @get:Rule val rule = createEmptyComposeRule()

    @Test fun rendersBackupAndSyncPanels() {
        ActivityScenario.launch(MainActivity::class.java).use {
            rule.onNodeWithText("Profile").performClick()
            rule.onNodeWithText("Device sync package").performScrollTo().assertIsDisplayed()
            rule.onNodeWithText("Export sync package").performScrollTo().assertIsDisplayed()
            rule.onNodeWithText("Import sync package").performScrollTo().assertIsDisplayed()
        }
    }
}
