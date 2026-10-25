package com.omnishop.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.omnishop.core.Shipment
import com.omnishop.core.ShipmentStatus
import kotlinx.coroutines.launch
import kotlin.time.Instant

@Composable
internal fun OrdersScreen(state: ShopSnapshot, presenter: ShopPresenter) {
    val scope = rememberCoroutineScope()
    val language = state.language
    val order = state.selectedOrder
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (order == null) {
            if (state.orders.isEmpty()) item { Text(language.text(Label.NO_ORDERS)) }
            items(state.orders, key = { it.id }) { summary ->
                OutlinedButton(onClick = { scope.launch { presenter.selectOrder(summary.id) } }, modifier = Modifier.fillMaxWidth()) {
                    Text("${summary.merchant} · ${Instant.fromEpochMilliseconds(summary.createdAtEpochMillis)}")
                }
            }
        } else {
            item {
                TextButton(onClick = { scope.launch { presenter.selectOrder(null) } }) { Text(language.text(Label.BACK)) }
                Text(order.merchant, style = MaterialTheme.typography.headlineSmall)
                Text("${language.text(Label.DELIVERY_PROGRESS)}: ${language.progress(order.deliveryProgress)}")
                order.items.forEach { Text("${it.title} × ${it.quantity}") }
            }
            item(key = "attach-${order.id}") { AttachShipmentForm(state, presenter) }
            if (order.shipments.isEmpty()) item { Text(language.text(Label.NO_SHIPMENTS)) }
            items(order.shipments, key = { it.id }) { shipment -> ShipmentCard(shipment, state, presenter) }
        }
    }
}

@Composable
private fun AttachShipmentForm(state: ShopSnapshot, presenter: ShopPresenter) {
    val language = state.language
    val scope = rememberCoroutineScope()
    var tracking by remember(state.selectedOrder?.id) { mutableStateOf("") }
    var carrier by remember(state.selectedOrder?.id) { mutableStateOf("") }
    var quantity by remember(state.selectedOrder?.id) { mutableStateOf("1") }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(language.text(Label.MANUAL_TRACKING), style = MaterialTheme.typography.titleSmall)
        OutlinedTextField(tracking, { tracking = it }, label = { Text(language.text(Label.TRACKING_NUMBER)) }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(carrier, { carrier = it }, label = { Text(language.text(Label.CARRIER)) }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(quantity, { quantity = it }, label = { Text(language.text(Label.QUANTITY)) }, modifier = Modifier.fillMaxWidth())
        Button(enabled = tracking.isNotBlank() && carrier.isNotBlank() && (quantity.toIntOrNull() ?: 0) > 0 && !state.busy, onClick = {
            scope.launch {
                presenter.attachShipment(tracking, carrier, quantity.toInt())
                if (presenter.state.value.error == null) { tracking = ""; carrier = "" }
            }
        }) { Text(language.text(Label.ATTACH_SHIPMENT)) }
    }
}

@Composable
private fun ShipmentCard(shipment: Shipment, state: ShopSnapshot, presenter: ShopPresenter) {
    val scope = rememberCoroutineScope()
    val language = state.language
    val label = state.shipmentLabels[shipment.id]
    var description by remember(shipment.id) { mutableStateOf("") }
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("${label?.carrierLabel.orEmpty()} · ${label?.trackingNumber.orEmpty()}", style = MaterialTheme.typography.titleMedium)
            Text(when (shipment.status) {
                ShipmentStatus.DELIVERED -> language.text(Label.DELIVERED)
                ShipmentStatus.IN_TRANSIT -> language.text(Label.IN_TRANSIT)
                else -> language.text(Label.MANUAL_TRACKING)
            })
            OutlinedTextField(description, { description = it }, label = { Text(language.text(Label.EVENT_DESCRIPTION)) }, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(ShipmentStatus.IN_TRANSIT to Label.IN_TRANSIT, ShipmentStatus.DELIVERED to Label.DELIVERED).forEach { (status, text) ->
                    TextButton(enabled = description.isNotBlank() && !state.busy, onClick = {
                        scope.launch {
                            presenter.recordManualEvent(shipment.id, status, description)
                            if (presenter.state.value.error == null) description = ""
                        }
                    }) { Text(language.text(text)) }
                }
            }
            val events = state.events[shipment.id].orEmpty()
            if (events.isEmpty()) Text(language.text(Label.NO_EVENTS))
            events.forEach { event ->
                HorizontalDivider()
                Text(event.description)
                Text("${language.text(Label.MANUAL_EVENT)} · ${Instant.fromEpochMilliseconds(event.importedAtEpochMillis)}",
                    style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
