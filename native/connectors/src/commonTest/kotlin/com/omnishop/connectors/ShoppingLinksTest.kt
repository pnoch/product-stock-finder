package com.omnishop.connectors

import kotlin.test.*

class ShoppingLinksTest {
    @Test fun preservesProductLinkWithoutInventingMetadata() {
        assertEquals("https://example.com/item?id=1", validatedBookmarkUrl("https://example.com/item?id=1"))
    }

    @Test fun rejectsUnsafeSchemesCredentialsAndLocalDestinations() {
        listOf("javascript:alert(1)", "file:///etc/passwd", "http://example.com", "https://user:password@example.com/p",
            "https://localhost/p", "https://127.0.0.1/p", "https://[::1]/p", "https://shop.local/p", "https://example.com:444/p").forEach {
            assertFails { validatedBookmarkUrl(it) }
        }
    }

    @Test fun searchEncodesTheWholeQueryInsteadOfInjectingAnotherParameter() {
        val url = externalSearchUrl("ebay", "tablet & used")
        assertTrue(url.startsWith("https://www.ebay.com/sch/i.html?_nkw="))
        assertFalse(url.contains("& used"))
    }

    @Test fun unknownSourceCannotOpenAnArbitraryDestination() {
        assertFailsWith<IllegalArgumentException> { externalSearchUrl("https://evil.example", "tablet") }
    }
}
