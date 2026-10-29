package com.omnishop.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SyncPagerTest {
    @Test fun pagesChangesWithoutSkippingOrDuplicating() {
        val all = (1..5).map {
            SyncChange("watchlist", "p$it", it.toLong(), "device", null, "x".repeat(100))
        }
        val original = SyncBatch(all, SyncCursor(5, "device", "p5"))
        val pages = mutableListOf<SyncBatch>()
        var cursor = SyncCursor.START
        while (true) {
            val page = SyncPager.limit(
                SyncBatch(all.filter { change ->
                    change.updatedAt > cursor.updatedAt ||
                        (change.updatedAt == cursor.updatedAt && change.id > cursor.id)
                }, original.cursor),
                320,
            )
            pages += page
            if (page.changes.isEmpty()) break
            cursor = page.cursor
        }
        assertEquals(all, pages.flatMap { it.changes })
        assertTrue(pages.dropLast(1).all { it.changes.isNotEmpty() })
    }
}
