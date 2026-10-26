package com.omnishop.app

import com.omnishop.data.SecretStore
import com.omnishop.data.security.BackupCrypto
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/** Simple Swift-facing crypto closures; avoids exporting Kotlin interfaces to Swift. */
class IosCryptoCallbacks(
    val random: (Int) -> ByteArray,
    val derive: (String, ByteArray, Int) -> ByteArray?,
    val seal: (ByteArray, ByteArray, ByteArray, ByteArray) -> ByteArray?,
    val open: (ByteArray, ByteArray, ByteArray, ByteArray) -> ByteArray?,
)

class CallbackBackupCrypto(private val callbacks: IosCryptoCallbacks) : BackupCrypto {
    override fun randomBytes(size: Int): ByteArray = callbacks.random(size)
    override fun deriveKey(password: CharArray, salt: ByteArray, iterations: Int): ByteArray =
        callbacks.derive(password.concatToString(), salt, iterations) ?: error("Key derivation is unavailable")
    override fun seal(
        key: ByteArray,
        nonce: ByteArray,
        aad: ByteArray,
        plaintext: ByteArray,
    ): ByteArray = callbacks.seal(key, nonce, aad, plaintext) ?: error("Encryption is unavailable")
    override fun open(
        key: ByteArray,
        nonce: ByteArray,
        aad: ByteArray,
        ciphertext: ByteArray,
    ): ByteArray? = callbacks.open(key, nonce, aad, ciphertext)
}

class IosSecretCallbacks(
    val get: (String) -> ByteArray?,
    val set: (String, ByteArray) -> Unit,
    val delete: (String) -> Unit,
)

class CallbackSecretStore(private val callbacks: IosSecretCallbacks) : SecretStore {
    override fun get(key: String): ByteArray? = callbacks.get(key)
    override fun set(key: String, value: ByteArray) = callbacks.set(key, value)
    override fun delete(key: String) = callbacks.delete(key)
}

class IosBackupCallbacks(
    /** Null means success; a non-null string is a user-facing failure reason. */
    val save: (String, ByteArray, (String?) -> Unit) -> Unit,
    val open: ((ByteArray?) -> Unit) -> Unit,
)

class CallbackBackupFiles(private val callbacks: IosBackupCallbacks) : BackupFiles {
    override suspend fun save(defaultName: String, bytes: ByteArray): Boolean =
        suspendCancellableCoroutine { continuation ->
            callbacks.save(defaultName, bytes) { error -> continuation.resume(error == null) }
        }

    override suspend fun open(): ByteArray? =
        suspendCancellableCoroutine { continuation -> callbacks.open { continuation.resume(it) } }
}
