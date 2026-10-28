package com.omnishop.app

import com.omnishop.data.SyncBatch
import com.omnishop.data.SyncJson
import com.omnishop.data.SyncResult

object IosSyncCodec {
    fun encodeBatch(batch: SyncBatch): String = SyncJson.encodeBatch(batch)
    fun decodeBatch(value: String): SyncBatch = SyncJson.decodeBatch(value)
    fun success(applied: Int, sent: Int, sas: String?): SyncResult = SyncResult.Success(applied, sent, sas)
    fun failure(message: String): SyncResult = SyncResult.Failure(message)
}
