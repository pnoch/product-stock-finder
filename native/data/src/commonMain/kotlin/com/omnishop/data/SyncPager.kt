package com.omnishop.data

object SyncPager {
    fun limit(batch: SyncBatch, maxBytes: Int): SyncBatch {
        require(maxBytes > 0)
        if (batch.changes.isEmpty()) return batch
        val kept = mutableListOf<SyncChange>()
        var cursor = batch.cursor
        for (change in batch.changes) {
            val nextCursor = SyncCursor(change.updatedAt, change.originDevice, change.id)
            val candidate = SyncBatch(kept + change, nextCursor)
            val size = SyncJson.encodeBatch(candidate).encodeToByteArray().size
            if (kept.isNotEmpty() && size > maxBytes) break
            require(size <= maxBytes) { "A single sync change exceeds the payload cap" }
            kept += change
            cursor = nextCursor
        }
        return SyncBatch(kept, cursor)
    }
}
