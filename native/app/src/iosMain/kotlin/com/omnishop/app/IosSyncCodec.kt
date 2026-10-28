package com.omnishop.app

import com.omnishop.data.SyncBatch
import com.omnishop.data.SyncJson

object IosSyncCodec {
    fun encodeBatch(batch: SyncBatch): String = SyncJson.encodeBatch(batch)
    fun decodeBatch(value: String): SyncBatch = SyncJson.decodeBatch(value)
}
