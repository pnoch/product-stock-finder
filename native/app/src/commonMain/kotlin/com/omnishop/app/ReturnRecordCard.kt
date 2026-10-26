package com.omnishop.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.omnishop.core.*
import kotlinx.coroutines.launch

@Composable
internal fun ReturnRecordCard(record: ReturnRecord, order: PurchaseOrder, state: ShopSnapshot, presenter: ShopPresenter) {
    val language = state.language
    var editing by remember(record.id) { mutableStateOf(false) }
    val title = order.items.first { it.id == record.orderItemId }.title
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("$title × ${record.quantity}", style = MaterialTheme.typography.titleMedium)
            Text(language.returnStatus(record.status))
            Text(record.reason)
            record.refund?.let { Text("${language.text(Label.RECORDED_REFUND)}: ${it.decimalString()} ${it.currency.code}") }
            record.returnTrackingNumber?.let { Text(it) }
            record.notes?.let { Text(it) }
            TextButton(onClick = { editing = true }, enabled = !state.busy) { Text(language.text(Label.UPDATE_RETURN)) }
        }
    }
    if (editing) ReturnUpdateDialog(record, state, presenter) { editing = false }
}

@Composable
private fun ReturnUpdateDialog(record: ReturnRecord, state: ShopSnapshot, presenter: ShopPresenter, close: () -> Unit) {
    val language = state.language
    val scope = rememberCoroutineScope()
    val currency = record.refund?.currency ?: Currency.THB
    var status by remember(record) { mutableStateOf(record.status) }
    var refund by remember(record) { mutableStateOf(record.refund?.decimalString().orEmpty()) }
    var tracking by remember(record) { mutableStateOf(record.returnTrackingNumber.orEmpty()) }
    var notes by remember(record) { mutableStateOf(record.notes.orEmpty()) }
    var expanded by remember { mutableStateOf(false) }
    val parsed = refund.trim().takeIf { it.isNotEmpty() }?.let { runCatching { parseNonNegativeMoney(it, currency) }.getOrNull() }
    val valid = (refund.isBlank() || parsed != null) && (!status.requiresRefundAmount || (parsed?.minorUnits ?: 0L) > 0L) &&
        tracking.trim().length <= 256 && notes.trim().length <= 2000
    AlertDialog(
        onDismissRequest = { if (!state.busy) close() },
        title = { Text(language.text(Label.UPDATE_RETURN)) },
        text = {
            Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Box {
                    OutlinedButton(onClick = { expanded = true }) { Text(language.returnStatus(status)) }
                    DropdownMenu(expanded, onDismissRequest = { expanded = false }) {
                        ReturnStatus.entries.forEach { option ->
                            DropdownMenuItem(text = { Text(language.returnStatus(option)) }, onClick = { status = option; expanded = false })
                        }
                    }
                }
                OutlinedTextField(refund, { refund = it }, label = { Text("${language.text(Label.REFUND_AMOUNT)} (${currency.code})") }, singleLine = true)
                OutlinedTextField(tracking, { tracking = it }, label = { Text(language.text(Label.RETURN_TRACKING)) })
                OutlinedTextField(notes, { notes = it }, label = { Text(language.text(Label.RETURN_NOTES)) })
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(enabled = valid && !state.busy, onClick = {
                scope.launch {
                    presenter.updateReturn(record.id, status, refund, tracking, notes)
                    if (presenter.state.value.error == null) close()
                }
            }) { Text(language.text(Label.SAVE)) }
        },
        dismissButton = { TextButton(enabled = !state.busy, onClick = close) { Text(language.text(Label.CANCEL)) } },
    )
}
