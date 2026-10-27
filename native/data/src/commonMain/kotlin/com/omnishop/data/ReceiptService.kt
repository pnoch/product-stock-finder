package com.omnishop.data

import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.time.Clock

data class ReceiptMetadata(
    val id: String,
    val orderId: String,
    val name: String,
    val mimeType: String?,
    val sizeBytes: Int,
    val addedAtEpochMillis: Long,
)

/**
 * Receipts are stored as authenticated private fields under the order, so they
 * inherit the same device key, encryption, and portable-backup path as the
 * shipping address. The private-field value is a small header plus Base64
 * content; the SQLite column itself is ciphertext.
 */
@OptIn(ExperimentalEncodingApi::class)
class ReceiptService(
    private val privateService: OrderPrivateService,
    private val store: ShoppingStore,
    private val newId: () -> String,
    private val now: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) {
    fun save(orderId: String, name: String, mimeType: String?, bytes: ByteArray): ReceiptMetadata {
        val cleanName = name.trim().replace('\n', ' ').replace('\r', ' ')
        require(cleanName.isNotBlank() && cleanName.length <= 200) { "Enter a receipt name" }
        val cleanMime = mimeType?.trim()?.replace('\n', ' ')?.replace('\r', ' ')?.takeIf { it.isNotEmpty() }
        require(cleanMime == null || cleanMime.length <= 100) { "Receipt MIME type is too long" }
        require(bytes.isNotEmpty()) { "The receipt file is empty" }
        require(bytes.size <= MAX_BYTES) { "Receipt files are limited to 8 MB" }
        val id = newId()
        require(id.length <= 48) { "Receipt id is too long" }
        val addedAt = now()
        val payload = listOf(
            cleanName,
            cleanMime.orEmpty(),
            bytes.size.toString(),
            addedAt.toString(),
            Base64.Default.encode(bytes),
        ).joinToString("\n")
        privateService.save(orderId, prefix(id), payload)
        store.recordSyncMeta("receipts", syncId(orderId, id), null)
        return ReceiptMetadata(id, orderId, cleanName, cleanMime, bytes.size, addedAt)
    }

    fun list(orderId: String): List<ReceiptMetadata> =
        privateService.exportAll()
            .asSequence()
            .filter { it.orderId == orderId && it.field.startsWith(PREFIX) }
            .mapNotNull { parseHeader(it.orderId, it.field.removePrefix(PREFIX), it.value) }
            .sortedByDescending { it.addedAtEpochMillis }
            .toList()

    fun read(orderId: String, receiptId: String): ByteArray? {
        val value = privateService.read(orderId, prefix(receiptId)) ?: return null
        return parse(orderId, receiptId, value)?.second
    }

    fun delete(orderId: String, receiptId: String) {
        privateService.save(orderId, prefix(receiptId), "")
        store.recordSyncMeta("receipts", syncId(orderId, receiptId), now())
    }

    fun syncPayload(id: String): String? {
        val (orderId, receiptId) = splitSyncId(id) ?: return null
        return privateService.read(orderId, prefix(receiptId))
    }

    fun applySyncPayload(change: SyncChange) {
        val (orderId, receiptId) = splitSyncId(change.id) ?: error("Invalid receipt sync id")
        val field = prefix(receiptId)
        if (change.deletedAt != null) {
            privateService.save(orderId, field, "")
        } else {
            privateService.save(orderId, field, requireNotNull(change.payload) { "Missing receipt payload" })
        }
        store.applySyncMeta(change.collection, change.id, change.updatedAt, change.originDevice, change.deletedAt)
    }

    private fun syncId(orderId: String, receiptId: String) = "$orderId\u0000$receiptId"

    private fun splitSyncId(id: String): Pair<String, String>? {
        val index = id.indexOf('\u0000')
        if (index <= 0 || index == id.lastIndex) return null
        return id.substring(0, index) to id.substring(index + 1)
    }

    private fun parseHeader(orderId: String, id: String, value: String): ReceiptMetadata? {
        val parts = value.split('\n', limit = 5)
        if (parts.size < 4) return null
        val size = parts[2].toIntOrNull()?.takeIf { it >= 0 } ?: return null
        val addedAt = parts[3].toLongOrNull()?.takeIf { it >= 0 } ?: return null
        return ReceiptMetadata(id, orderId, parts[0], parts[1].takeIf { it.isNotEmpty() }, size, addedAt)
    }

    private fun parse(orderId: String, id: String, value: String): Pair<ReceiptMetadata, ByteArray>? {
        val metadata = parseHeader(orderId, id, value) ?: return null
        val parts = value.split('\n', limit = 5)
        if (parts.size != 5) return null
        val bytes = runCatching { Base64.Default.decode(parts[4]) }.getOrNull() ?: return null
        if (bytes.size != metadata.sizeBytes) return null
        return metadata to bytes
    }

    private fun prefix(id: String) = "receipt.$id"

    companion object {
        const val MAX_BYTES = 8 * 1024 * 1024
        private const val PREFIX = "receipt."
    }
}
