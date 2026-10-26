package com.omnishop.desktop

import com.omnishop.app.BackupFiles
import java.awt.FileDialog
import java.awt.Frame
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class DesktopBackupFiles : BackupFiles {
    override suspend fun save(defaultName: String, bytes: ByteArray): Boolean = withContext(Dispatchers.IO) {
        val dialog = FileDialog(null as Frame?, "Save encrypted OmniShop backup", FileDialog.SAVE).apply {
            file = defaultName
        }
        dialog.isVisible = true
        val directory = dialog.directory ?: return@withContext false
        val name = dialog.file ?: return@withContext false
        File(directory, name).writeBytes(bytes)
        true
    }

    override suspend fun open(): ByteArray? = withContext(Dispatchers.IO) {
        val dialog = FileDialog(null as Frame?, "Open encrypted OmniShop backup", FileDialog.LOAD)
        dialog.isVisible = true
        val directory = dialog.directory ?: return@withContext null
        val name = dialog.file ?: return@withContext null
        File(directory, name).readBytes()
    }
}
