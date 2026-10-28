package com.omnishop.data

import kotlin.test.Test
import kotlin.test.assertEquals

class SyncJsonTest {
    @Test fun roundTripsBatch() {
        val batch = SyncBatch(
            listOf(SyncChange("watchlist", "p", 10, "device", null, "{\"id\":\"p\"}")),
            SyncCursor(10, "device", "p"),
        )
        val decoded = SyncJson.decodeBatch(SyncJson.encodeBatch(batch))
        assertEquals(batch, decoded)
    }
}
