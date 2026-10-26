package com.omnishop.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.omnishop.core.PurchaseOrder
import kotlinx.coroutines.launch

@Composable
internal fun ReturnRequestButton(order: PurchaseOrder, state: ShopSnapshot, presenter: ShopPresenter) {
    val language = state.language
    val scope = rememberCoroutineScope()
    var showing by remember(order.id) { mutableStateOf(false) }
    val reserved = state.returns.filter { it.reservesQuantity }.groupBy { it.orderItemId }
        .mapValues { (_, records) -> records.sumOf { it.quantity.toLong() } }
    val remaining = order.items.associate { it.id to it.quantity.toLong() - (reserved[it.id] ?: 0L) }
    val available = order.items.filter { remaining.getValue(it.id) > 0 }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(language.text(Label.RETURN_MANUAL_NOTICE), style = MaterialTheme.typography.bodySmall)
        if (available.isEmpty()) Text(language.text(Label.NO_RETURNABLE_UNITS))
        OutlinedButton(enabled = available.isNotEmpty() && !state.busy, onClick = { showing = true }) {
            Text(language.text(Label.RECORD_RETURN))
        }
    }
    if (showing) {
        var itemId by remember { mutableStateOf(available.firstOrNull()?.id.orEmpty()) }
        var quantity by remember { mutableStateOf("1") }
        var reason by remember { mutableStateOf("") }
        var expanded by remember { mutableStateOf(false) }
        val selected = order.items.firstOrNull { it.id == itemId }
        val count = quantity.toIntOrNull() ?: 0
        val valid = count > 0 && count <= (remaining[itemId] ?: 0L) && reason.isNotBlank() && reason.length <= 500
        AlertDialog(
            onDismissRequest = { if (!state.busy) showing = false },
            title = { Text(language.text(Label.RECORD_RETURN)) },
            text = {
                Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box {
                        OutlinedButton(onClick = { expanded = true }) { Text(selected?.title.orEmpty()) }
                        DropdownMenu(expanded, onDismissRequest = { expanded = false }) {
                            available.forEach { item ->
                                DropdownMenuItem(text = { Text(item.title) }, onClick = { itemId = item.id; quantity = "1"; expanded = false })
                            }
                        }
                    }
                    Text("${language.text(Label.REMAINING)}: ${remaining[itemId] ?: 0L}")
                    OutlinedTextField(quantity, { quantity = it }, label = { Text(language.text(Label.RETURN_QUANTITY)) }, singleLine = true)
                    OutlinedTextField(reason, { reason = it }, label = { Text(language.text(Label.RETURN_REASON)) })
                    state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(enabled = valid && !state.busy, onClick = {
                    scope.launch {
                        presenter.createReturn(itemId, count, reason)
                        if (presenter.state.value.error == null) showing = false
                    }
                }) { Text(language.text(Label.SAVE)) }
            },
            dismissButton = { TextButton(enabled = !state.busy, onClick = { showing = false }) { Text(language.text(Label.CANCEL)) } },
        )
    }
}
