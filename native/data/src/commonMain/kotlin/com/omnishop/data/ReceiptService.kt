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
    private val newId: () -> String,
    private val now: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) {
    fun save(orderId: String, name: String, mimeType: String?, bytes: ByteArray): ReceiptMetadata {
        val cleanName = name.trim()
        require(cleanName.isNotBlank() && cleanName.length <= 200) { "Enter a receipt name" }
        require(bytes.isNotEmpty()) { "The receipt file is empty" }
        require(bytes.size <= MAX_BYTES) { "Receipt files are limited to 8 MB" }
        val id = newId()
        require(id.length <= 48) { "Receipt id is too long" }
        val addedAt = now()
        val payload = listOf(
            cleanName,
            mimeType?.trim()?.takeIf { it.isNotEmpty() }.orEmpty(),
            bytes.size.toString(),
            addedAt.toString(),
            Base64.Default.encode(bytes),
        ).joinToString("\n")
        privateService.save(orderId, prefix(id), payload)
        return ReceiptMetadata(id, orderId, cleanName, mimeType?.trim()?.takeIf { it.isNotEmpty() }, bytes.size, addedAt)
    }

    fun list(orderId: String): List<ReceiptMetadata> =
        privateService.exportAll()
            .asSequence()
            .filter { it.orderId == orderId && it.field.startsWith(PREFIX) }
            .mapNotNull { parse(it.orderId, it.field.removePrefix(PREFIX), it.value)?.first }
            .sortedByDescending { it.addedAtEpochMillis }
            .toList()

    fun read(orderId: String, receiptId: String): ByteArray? {
        val value = privateService.read(orderId, prefix(receiptId)) ?: return null
        return parse(orderId, receiptId, value)?.second
    }

    fun delete(orderId: String, receiptId: String) {
        privateService.save(orderId, prefix(receiptId), "")
    }

    private fun parse(orderId: String, id: String, value: String): Pair<ReceiptMetadata, ByteArray>? {
        val parts = value.split('\n', limit = 5)
        if (parts.size != 5) return null
        val size = parts[2].toIntOrNull() ?: return null
        val addedAt = parts[3].toLongOrNull() ?: return null
        val bytes = runCatching { Base64.Default.decode(parts[4]) }.getOrNull() ?: return null
        if (bytes.size != size) return null
        return ReceiptMetadata(id, orderId, parts[0], parts[1].takeIf { it.isNotEmpty() }, size, addedAt) to bytes
    }

    private fun prefix(id: String) = "receipt.$id"

    companion object {
        const val MAX_BYTES = 8 * 1024 * 1024
        private const val PREFIX = "receipt."
    }
}
