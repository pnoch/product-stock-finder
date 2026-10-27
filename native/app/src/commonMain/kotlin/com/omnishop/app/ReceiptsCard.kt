package com.omnishop.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.omnishop.core.PurchaseOrder
import com.omnishop.data.ReceiptMetadata
import com.omnishop.data.ReceiptService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun ReceiptsCard(
    order: PurchaseOrder,
    state: ShopSnapshot,
    receiptsService: ReceiptService,
    files: BackupFiles,
) {
    val language = state.language
    val scope = rememberCoroutineScope()
    var receipts by remember(order.id) { mutableStateOf<List<ReceiptMetadata>>(emptyList()) }
    var refresh by remember(order.id) { mutableStateOf(0) }
    var adding by remember(order.id) { mutableStateOf(false) }
    var message by remember(order.id) { mutableStateOf<String?>(null) }
    LaunchedEffect(order.id, refresh) {
        receipts = runCatching { withContext(Dispatchers.Default) { receiptsService.list(order.id) } }
            .getOrElse { emptyList() }
    }
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(language.text(Label.RECEIPTS), style = MaterialTheme.typography.titleMedium)
            if (receipts.isEmpty()) Text(language.text(Label.NO_RECEIPTS))
            receipts.forEach { receipt ->
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(receipt.name, style = MaterialTheme.typography.bodyLarge)
                    Text("${receipt.sizeBytes} bytes", style = MaterialTheme.typography.bodySmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(enabled = !state.busy, onClick = {
                            scope.launch {
                                val bytes = runCatching {
                                    withContext(Dispatchers.Default) {
                                        receiptsService.read(order.id, receipt.id)
                                    }
                                }.getOrNull()
                                if (bytes == null) {
                                    message = language.text(Label.RECEIPT_FILE_ERROR)
                                } else {
                                    val saved = runCatching { files.save(receipt.name, bytes) }.getOrDefault(false)
                                    if (!saved) message = language.text(Label.RECEIPT_SAVE_CANCELLED)
                                }
                            }
                        }) { Text(language.text(Label.SAVE_COPY)) }
                        TextButton(enabled = !state.busy, onClick = {
                            scope.launch {
                                runCatching { withContext(Dispatchers.Default) { receiptsService.delete(order.id, receipt.id) } }
                                    .onSuccess {
                                        message = language.text(Label.RECEIPT_DELETED)
                                        refresh++
                                    }
                                    .onFailure { message = "${language.text(Label.RECEIPT_SAVE_FAILED)} ${it.message}" }
                            }
                        }) { Text(language.text(Label.DELETE)) }
                    }
                }
                HorizontalDivider()
            }
            OutlinedButton(enabled = !state.busy, onClick = { adding = true }) {
                Text(language.text(Label.ADD_RECEIPT))
            }
            message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
    if (adding) {
        ReceiptDialog(order.id, state.language, receiptsService, files, onClose = { adding = false }, onSaved = {
            adding = false
            message = state.language.text(Label.RECEIPT_SAVED)
            refresh++
        })
    }
}

@Composable
private fun ReceiptDialog(
    orderId: String,
    language: AppLanguage,
    receiptsService: ReceiptService,
    files: BackupFiles,
    onClose: () -> Unit,
    onSaved: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var content by remember { mutableStateOf<ByteArray?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = { if (!working) onClose() },
        title = { Text(language.text(Label.ADD_RECEIPT)) },
        text = {
            Column(Modifier.heightIn(max = 360.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text(language.text(Label.RECEIPT_NAME)) }, modifier = Modifier.fillMaxWidth())
                OutlinedButton(enabled = !working, onClick = {
                    scope.launch {
                        val bytes = runCatching { files.open() }.getOrNull()
                        if (bytes == null) {
                            error = language.text(Label.RECEIPT_CANCELLED)
                        } else {
                            content = bytes
                            if (name.isBlank()) name = "Receipt"
                            error = null
                        }
                    }
                }) { Text(language.text(Label.CHOOSE_FILE)) }
                content?.let { Text("${it.size} bytes", style = MaterialTheme.typography.bodySmall) }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(enabled = name.isNotBlank() && content != null && !working, onClick = {
                working = true
                val bytes = content ?: return@TextButton
                scope.launch {
                    runCatching {
                        withContext(Dispatchers.Default) { receiptsService.save(orderId, name, null, bytes) }
                    }.onSuccess { onSaved() }.onFailure {
                        error = "${language.text(Label.RECEIPT_SAVE_FAILED)} ${it.message}"
                    }
                    working = false
                }
            }) { Text(language.text(Label.SAVE)) }
        },
        dismissButton = {
            TextButton(enabled = !working, onClick = onClose) { Text(language.text(Label.CANCEL)) }
        },
    )
}
