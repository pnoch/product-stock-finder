package com.omnishop.app

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.omnishop.data.BackupService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.time.Clock

private enum class BackupMode { EXPORT, RESTORE }

@Composable
internal fun BackupPanel(
    language: AppLanguage,
    backup: BackupService,
    files: BackupFiles,
    onRestored: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf<BackupMode?>(null) }
    var pendingRestore by remember { mutableStateOf<ByteArray?>(null) }
    var password by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(language.text(Label.BACKUP), style = MaterialTheme.typography.titleMedium)
        Text(language.text(Label.BACKUP_NOTE), style = MaterialTheme.typography.bodySmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(enabled = !working, onClick = {
                password = ""
                pendingRestore = null
                mode = BackupMode.EXPORT
            }) { Text(language.text(Label.EXPORT_BACKUP)) }
            OutlinedButton(enabled = !working, onClick = {
                scope.launch {
                    val bytes = runCatching { files.open() }.getOrNull()
                    if (bytes == null) {
                        message = language.text(Label.BACKUP_CANCELLED)
                    } else {
                        pendingRestore = bytes
                        password = ""
                        mode = BackupMode.RESTORE
                    }
                }
            }) { Text(language.text(Label.RESTORE_BACKUP)) }
        }
        message?.let { Text(it) }
        if (working) LinearProgressIndicator(Modifier.fillMaxWidth())
    }

    mode?.let { current ->
        AlertDialog(
            onDismissRequest = { if (!working) { mode = null; pendingRestore = null } },
            title = {
                Text(language.text(if (current == BackupMode.EXPORT) Label.EXPORT_BACKUP else Label.RESTORE_BACKUP))
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (current == BackupMode.RESTORE) {
                        Text(language.text(Label.BACKUP_REPLACE_WARNING), color = MaterialTheme.colorScheme.error)
                    }
                    OutlinedTextField(
                        value = password,
                        onValueChange = { if (it.length <= 128) password = it },
                        label = { Text(language.text(Label.BACKUP_PASSWORD)) },
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
                            if (current == BackupMode.EXPORT) {
                                val bytes = withContext(Dispatchers.Default) {
                                    backup.export(chars, Clock.System.now().toEpochMilliseconds())
                                }
                                message = if (files.save("omnishop-backup.omb", bytes)) {
                                    language.text(Label.BACKUP_EXPORTED)
                                } else {
                                    language.text(Label.BACKUP_CANCELLED)
                                }
                            } else {
                                val bytes = pendingRestore
                                if (bytes == null) {
                                    message = language.text(Label.BACKUP_CANCELLED)
                                } else {
                                    withContext(Dispatchers.Default) { backup.restore(bytes, chars) }
                                    message = language.text(Label.BACKUP_RESTORED)
                                    onRestored()
                                }
                            }
                            mode = null
                            pendingRestore = null
                            password = ""
                        } catch (failure: Exception) {
                            message = "${language.text(Label.BACKUP_FAILED)} ${failure.message.orEmpty()}"
                        } finally {
                            chars.fill('\u0000')
                            working = false
                        }
                    }
                }) { Text(language.text(if (current == BackupMode.EXPORT) Label.SAVE else Label.RESTORE)) }
            },
            dismissButton = {
                TextButton(enabled = !working, onClick = { mode = null; pendingRestore = null; password = "" }) {
                    Text(language.text(Label.CANCEL))
                }
            },
        )
    }
}
