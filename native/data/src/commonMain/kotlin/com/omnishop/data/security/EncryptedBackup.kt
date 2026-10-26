package com.omnishop.data.security

object EncryptedBackup {
    private val MAGIC = "OMNISHOP-BACKUP".encodeToByteArray()
    private const val VERSION = 1
    private const val SALT_BYTES = 16
    private const val NONCE_BYTES = 12
    private const val HEADER_BYTES = 4 + SALT_BYTES + NONCE_BYTES + 8
    private const val MAX_CIPHERTEXT_BYTES = 64 * 1024 * 1024
    private const val MAX_ITERATIONS = 2_000_000
    const val DEFAULT_ITERATIONS = 600_000
    const val MIN_PASSWORD_LENGTH = 8

    fun encrypt(
        plaintext: ByteArray,
        password: CharArray,
        createdAtEpochMillis: Long,
        crypto: BackupCrypto,
    ): ByteArray {
        require(password.size >= MIN_PASSWORD_LENGTH) { "Use a backup password of at least $MIN_PASSWORD_LENGTH characters" }
        require(plaintext.size in 1..MAX_CIPHERTEXT_BYTES) { "Backup payload is too large" }
        val salt = crypto.randomBytes(SALT_BYTES)
        val nonce = crypto.randomBytes(NONCE_BYTES)
        val key = crypto.deriveKey(password, salt, DEFAULT_ITERATIONS)
        try {
            val header = Writer().apply {
                int(DEFAULT_ITERATIONS)
                bytes(salt)
                bytes(nonce)
                long(createdAtEpochMillis)
            }.toByteArray()
            val aad = MAGIC + byteArrayOf(VERSION.toByte()) + header
            val ciphertext = crypto.seal(key, nonce, aad, plaintext)
            return Writer().apply {
                bytes(aad)
                int(ciphertext.size)
                bytes(ciphertext)
            }.toByteArray()
        } finally {
            key.fill(0)
        }
    }

    fun decrypt(input: ByteArray, password: CharArray, crypto: BackupCrypto): ByteArray {
        try {
            val reader = Reader(input)
            require(reader.bytes(MAGIC.size).contentEquals(MAGIC)) { "Not an OmniShop backup" }
            val version = reader.byte()
            require(version == VERSION) { "Unsupported backup version" }
            val header = reader.bytes(HEADER_BYTES)
            val headerReader = Reader(header)
            val iterations = headerReader.int()
            require(iterations in 1..MAX_ITERATIONS) { "Unsupported key-derivation cost" }
            val salt = headerReader.bytes(SALT_BYTES)
            val nonce = headerReader.bytes(NONCE_BYTES)
            headerReader.long()
            val ciphertextLength = reader.int()
            require(ciphertextLength in 1..MAX_CIPHERTEXT_BYTES && ciphertextLength == reader.remaining) {
                "Invalid backup length"
            }
            val ciphertext = reader.bytes(ciphertextLength)
            val aad = MAGIC + byteArrayOf(version.toByte()) + header
            val key = crypto.deriveKey(password, salt, iterations)
            try {
                return crypto.open(key, nonce, aad, ciphertext)
            } finally {
                key.fill(0)
            }
        } catch (failure: BackupAuthenticationException) {
            throw failure
        } catch (failure: BackupFormatException) {
            throw failure
        } catch (failure: Exception) {
            // Wrong password, tampering, truncation and malformed input share
            // one response so the caller cannot distinguish them.
            throw BackupAuthenticationException(failure)
        }
    }

    private class Writer {
        private val out = ArrayList<Byte>()
        fun byte(value: Int) = apply { out.add(value.toByte()) }
        fun int(value: Int) = apply {
            out.add((value ushr 24).toByte()); out.add((value ushr 16).toByte())
            out.add((value ushr 8).toByte()); out.add(value.toByte())
        }
        fun long(value: Long) = apply {
            for (shift in 56 downTo 0 step 8) out.add((value ushr shift).toByte())
        }
        fun bytes(value: ByteArray) = apply { value.forEach(out::add) }
        fun toByteArray(): ByteArray = ByteArray(out.size) { out[it] }
    }

    private class Reader(private val data: ByteArray) {
        private var position = 0
        val remaining: Int get() = data.size - position
        fun byte(): Int {
            if (remaining < 1) throw BackupFormatException("Truncated backup")
            return data[position++].toInt() and 0xff
        }
        fun int(): Int = (byte() shl 24) or (byte() shl 16) or (byte() shl 8) or byte()
        fun long(): Long {
            var value = 0L
            repeat(8) { value = (value shl 8) or byte().toLong() }
            return value
        }
        fun bytes(count: Int): ByteArray {
            if (count < 0 || count > remaining) throw BackupFormatException("Truncated backup")
            return data.copyOfRange(position, position + count).also { position += count }
        }
    }
}
