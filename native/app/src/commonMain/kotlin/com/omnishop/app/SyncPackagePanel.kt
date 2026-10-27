package com.omnishop.app

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.omnishop.data.SyncPackageService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private enum class SyncMode { EXPORT, IMPORT }

@Composable
internal fun SyncPackagePanel(
    language: AppLanguage,
    service: SyncPackageService,
    files: BackupFiles,
    onImported: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf<SyncMode?>(null) }
    var pending by remember { mutableStateOf<ByteArray?>(null) }
    var password by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(language.text(Label.SYNC_PACKAGE), style = MaterialTheme.typography.titleMedium)
        Text(language.text(Label.SYNC_PACKAGE_NOTE), style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(enabled = !working, onClick = {
                pending = null
                password = ""
                mode = SyncMode.EXPORT
            }) { Text(language.text(Label.EXPORT_SYNC)) }
            OutlinedButton(enabled = !working, onClick = {
                scope.launch {
                    val bytes = runCatching { files.open() }.getOrNull()
                    if (bytes == null) {
                        message = language.text(Label.SYNC_CANCELLED)
                    } else {
                        pending = bytes
                        password = ""
                        mode = SyncMode.IMPORT
                    }
                }
            }) { Text(language.text(Label.IMPORT_SYNC)) }
        }
        message?.let { Text(it) }
        if (working) LinearProgressIndicator(Modifier.fillMaxWidth())
    }

    mode?.let { current ->
        AlertDialog(
            onDismissRequest = { if (!working) { mode = null; pending = null } },
            title = { Text(language.text(if (current == SyncMode.EXPORT) Label.EXPORT_SYNC else Label.IMPORT_SYNC)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = password,
                        onValueChange = { if (it.length <= 128) password = it },
                        label = { Text(language.text(Label.SYNC_PACKAGE_PASSWORD)) },
                        singleLine = true,
                    )
                    Text(language.text(Label.BACKUP_PASSWORD_HINT), style = MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton = {
                TextButton(enabled = password.length >= 8 && !working, onClick = {
                    working = true
                    val chars = password.toCharArray()
                    scope.launch {
                        try {
                            if (current == SyncMode.EXPORT) {
                                val bytes = withContext(Dispatchers.Default) { service.export(chars) }
                                message = if (files.save("omnishop-sync.omsync", bytes)) {
                                    language.text(Label.SYNC_EXPORTED)
                                } else {
                                    language.text(Label.SYNC_CANCELLED)
                                }
                            } else {
                                val bytes = pending
                                if (bytes == null) {
                                    message = language.text(Label.SYNC_CANCELLED)
                                } else {
                                    val count = withContext(Dispatchers.Default) { service.import(bytes, chars) }
                                    message = "${language.text(Label.SYNC_IMPORTED)} $count"
                                    onImported()
                                }
                            }
                            mode = null
                            pending = null
                            password = ""
                        } catch (failure: Exception) {
                            message = "${language.text(Label.SYNC_IMPORT_FAILED)} ${failure.message.orEmpty()}"
                        } finally {
                            chars.fill('\u0000')
                            working = false
                        }
                    }
                }) { Text(language.text(if (current == SyncMode.EXPORT) Label.SAVE else Label.IMPORT_SYNC)) }
            },
            dismissButton = {
                TextButton(enabled = !working, onClick = { mode = null; pending = null; password = "" }) {
                    Text(language.text(Label.CANCEL))
                }
            },
        )
    }
}
