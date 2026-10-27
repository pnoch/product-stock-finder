package com.omnishop.data

data class SyncDeviceInfo(
    val deviceId: String,
    val displayName: String,
    val fingerprint: String,
)

data class SyncPeerInfo(
    val deviceId: String,
    val displayName: String,
    val endpoint: String,
    val lastSyncAtEpochMillis: Long,
    val sas: String? = null,
)

data class SyncPairingCode(
    val code: String,
    val expiresAtEpochMillis: Long,
)

sealed interface SyncResult {
    data class Success(val applied: Int, val sent: Int, val sas: String? = null) : SyncResult
    data class Failure(val message: String) : SyncResult
}

interface SyncService : AutoCloseable {
    val unavailableReason: String? get() = null
    fun thisDevice(): SyncDeviceInfo
    fun peers(): List<SyncPeerInfo>
    suspend fun createPairing(): SyncPairingCode
    suspend fun pair(code: String): SyncResult
    suspend fun sync(peerId: String): SyncResult
    fun revoke(peerId: String)
    override fun close() = Unit
}

class UnavailableSyncService(
    private val reason: String = "Peer sync is available in the desktop preview only",
) : SyncService {
    override val unavailableReason: String = reason
    override fun thisDevice() = SyncDeviceInfo("unavailable", "This device", "")
    override fun peers(): List<SyncPeerInfo> = emptyList()
    override suspend fun createPairing(): SyncPairingCode = throw IllegalStateException(reason)
    override suspend fun pair(code: String): SyncResult = SyncResult.Failure(reason)
    override suspend fun sync(peerId: String): SyncResult = SyncResult.Failure(reason)
    override fun revoke(peerId: String) = Unit
}
