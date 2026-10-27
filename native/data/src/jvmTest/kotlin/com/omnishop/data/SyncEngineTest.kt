package com.omnishop.data

import com.omnishop.core.*
import kotlin.test.*

class SyncEngineTest {
    @Test fun syncsSettingsWithCursorsAndLww() {
        var timeA = 100L
        var timeB = 200L
        ShoppingStore.inMemory("a") { timeA }.use { a ->
            ShoppingStore.inMemory("b") { timeB }.use { b ->
                a.setPreference("language", "THAI")
                val first = SyncEngine(a).localChanges(SyncCursor.START)
                assertEquals(1, first.changes.size)
                assertEquals(1, SyncEngine(b).apply(first.changes))
                assertEquals("THAI", b.preference("language"))
                assertTrue(SyncEngine(a).localChanges(first.cursor).changes.isEmpty())

                b.setPreference("language", "ENGLISH")
                val older = SyncChange("settings", "language", 100, "a", null, "THAI")
                assertEquals(0, SyncEngine(b).apply(listOf(older)))
                assertEquals("ENGLISH", b.preference("language"))

                timeA = 300
                a.deletePreference("language")
                val tombstone = SyncEngine(a).localChanges(SyncCursor.START).changes.single()
                assertNotNull(tombstone.deletedAt)
                assertNull(tombstone.payload)
                assertEquals(1, SyncEngine(b).apply(listOf(tombstone)))
                assertNull(b.preference("language"))
            }
        }
    }

    @Test fun syncsWatchlistAggregateAndTombstone() {
        var timeA = 100L
        ShoppingStore.inMemory("a") { timeA }.use { a ->
            ShoppingStore.inMemory("b") { 200 }.use { b ->
                a.saveProduct(SavedProduct("p", "Tablet", "https://example.com/tablet", 90))
                a.saveOffer(Offer("l", "p", "Seller A", CostEstimate(Money(800_000, Currency.THB))), 95)
                val batch = SyncEngine(a).localChanges(SyncCursor.START)
                assertEquals(1, batch.changes.size)
                assertEquals(1, SyncEngine(b).apply(batch.changes))
                assertEquals("Tablet", b.listProducts().single().title)
                assertEquals(1, b.offersForProducts(listOf("p")).getValue("p").size)

                timeA = 200
                a.deleteProduct("p")
                val tombstone = SyncEngine(a).localChanges(SyncCursor.START).changes.single()
                assertEquals(1, SyncEngine(b).apply(listOf(tombstone)))
                assertTrue(b.listProducts().isEmpty())
                assertTrue(b.offersForProducts(listOf("p")).isEmpty())
            }
        }
    }

    @Test fun deviceIdBreaksEqualTimestampTies() {
        ShoppingStore.inMemory("a") { 100 }.use { a ->
            ShoppingStore.inMemory("b") { 100 }.use { b ->
                a.saveProduct(SavedProduct("p", "From A", null, 90))
                b.saveProduct(SavedProduct("p", "From B", null, 90))
                val fromA = SyncEngine(a).localChanges(SyncCursor.START).changes.single()
                val fromB = SyncEngine(b).localChanges(SyncCursor.START).changes.single()
                SyncEngine(b).apply(listOf(fromA))
                assertEquals("From B", b.listProducts().single().title)
                SyncEngine(a).apply(listOf(fromB))
                assertEquals("From B", a.listProducts().single().title)
            }
        }
    }

    @Test fun rejectsMalformedRemotePayloadWithoutChangingLocalData() {
        ShoppingStore.inMemory("b") { 100 }.use { b ->
            b.saveProduct(SavedProduct("keep", "Keep", null, 90))
            assertFails {
                SyncEngine(b).apply(listOf(SyncChange("watchlist", "p", 200, "a", null, "{}")))
            }
            assertEquals("Keep", b.listProducts().single().title)
        }
    }
}
