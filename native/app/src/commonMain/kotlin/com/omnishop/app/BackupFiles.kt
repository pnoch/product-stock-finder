package com.omnishop.app

/** Platform file access for encrypted backups. Implementations must not persist the backup themselves. */
interface BackupFiles {
    suspend fun save(defaultName: String, bytes: ByteArray): Boolean
    suspend fun open(): ByteArray?
}
