package com.omnishop.data

import kotlin.test.*

class CarrierSettingsTest {
    @Test fun storesTrimsAndClearsTheApiKey() {
        val secrets = InMemorySecretStore()
        val settings = CarrierSettings(secrets)
        assertFalse(settings.isThailandPostConfigured())
        settings.setThailandPostApiKey("  api-key-value  ")
        assertEquals("api-key-value", settings.thailandPostApiKey())
        assertTrue(settings.isThailandPostConfigured())
        settings.clearThailandPostApiKey()
        assertNull(settings.thailandPostApiKey())
    }

    @Test fun rejectsBlankAndOversizedKeys() {
        val settings = CarrierSettings(InMemorySecretStore())
        assertFailsWith<IllegalArgumentException> { settings.setThailandPostApiKey(" ") }
        assertFailsWith<IllegalArgumentException> { settings.setThailandPostApiKey("x".repeat(513)) }
    }
}
