package com.omnishop.android

import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import com.omnishop.app.BackupFiles
import kotlin.coroutines.resume
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

class AndroidBackupFiles(private val activity: ComponentActivity) : BackupFiles {
    private var pendingSave: CancellableContinuation<Uri?>? = null
    private var pendingOpen: CancellableContinuation<Uri?>? = null

    private val saveLauncher = activity.registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/octet-stream"),
    ) { uri ->
        pendingSave?.takeIf { it.isActive }?.resume(uri)
        pendingSave = null
    }

    private val openLauncher = activity.registerForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri ->
        pendingOpen?.takeIf { it.isActive }?.resume(uri)
        pendingOpen = null
    }

    override suspend fun save(defaultName: String, bytes: ByteArray): Boolean {
        val uri = suspendCancellableCoroutine<Uri?> { continuation ->
            pendingSave = continuation
            continuation.invokeOnCancellation { pendingSave = null }
            saveLauncher.launch(defaultName)
        } ?: return false
        return withContext(Dispatchers.IO) {
            activity.contentResolver.openOutputStream(uri)?.use { stream ->
                stream.write(bytes)
                true
            } ?: false
        }
    }

    override suspend fun open(): ByteArray? {
        val uri = suspendCancellableCoroutine<Uri?> { continuation ->
            pendingOpen = continuation
            continuation.invokeOnCancellation { pendingOpen = null }
            openLauncher.launch(arrayOf("*/*"))
        } ?: return null
        return withContext(Dispatchers.IO) {
            activity.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        }
    }
}
