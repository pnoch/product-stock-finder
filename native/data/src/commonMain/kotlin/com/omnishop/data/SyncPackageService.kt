package com.omnishop.data

import com.omnishop.data.security.BackupCrypto
import com.omnishop.data.security.BackupFormatException
import com.omnishop.data.security.EncryptedBackup
import kotlin.time.Clock

/**
 * Manual encrypted sync package. It carries current LWW records (including
 * tombstones) and merges on import. This is not peer-to-peer transport and does
 * not create device identities or trust.
 */
class SyncPackageService(
    private val store: ShoppingStore,
    private val crypto: BackupCrypto,
    private val now: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) {
    fun export(password: CharArray): ByteArray {
        val changes = mutableListOf<SyncChange>()
        var cursor = SyncCursor.START
        val engine = SyncEngine(store)
        while (true) {
            val batch = engine.localChanges(cursor, limit = 500)
            changes += batch.changes
            if (batch.changes.isEmpty() || batch.cursor == cursor) break
            cursor = batch.cursor
        }
        val plaintext = SyncJson.json.encodeToString(
            SyncPackage.serializer(),
            SyncPackage(changes = changes),
        ).encodeToByteArray()
        return EncryptedBackup.encrypt(plaintext, password, now(), crypto)
    }

    fun import(bytes: ByteArray, password: CharArray): Int {
        val plaintext = EncryptedBackup.decrypt(bytes, password, crypto).decodeToString()
        val packageData = runCatching {
            SyncJson.json.decodeFromString(SyncPackage.serializer(), plaintext)
        }.getOrElse { throw BackupFormatException("Sync package contents are invalid", it) }
        if (packageData.version != 1) throw BackupFormatException("Unsupported sync package version")
        return SyncEngine(store).apply(packageData.changes)
    }
}
