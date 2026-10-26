package com.omnishop.data.security

class BackupAuthenticationException(cause: Throwable? = null) :
    Exception("Backup cannot be decrypted with this password", cause)

class BackupFormatException(message: String, cause: Throwable? = null) : Exception(message, cause)

interface BackupCrypto {
    fun randomBytes(size: Int): ByteArray
    fun deriveKey(password: CharArray, salt: ByteArray, iterations: Int): ByteArray
    fun seal(key: ByteArray, nonce: ByteArray, aad: ByteArray, plaintext: ByteArray): ByteArray
    fun open(key: ByteArray, nonce: ByteArray, aad: ByteArray, ciphertext: ByteArray): ByteArray
}
