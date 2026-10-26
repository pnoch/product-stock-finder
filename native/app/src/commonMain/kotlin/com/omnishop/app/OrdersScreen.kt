package com.omnishop.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.omnishop.carriers.CarrierAdapter
import com.omnishop.carriers.CarrierCredentials
import com.omnishop.carriers.CarrierResult
import com.omnishop.core.ObservationMethod
import com.omnishop.core.PurchaseOrder
import com.omnishop.core.Shipment
import com.omnishop.core.ShipmentStatus
import com.omnishop.data.CarrierSettings
import com.omnishop.data.OrderPrivateService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.time.Instant

@Composable
internal fun OrdersScreen(
    state: ShopSnapshot,
    presenter: ShopPresenter,
    privateService: OrderPrivateService,
    carrierSettings: CarrierSettings,
    carriers: List<CarrierAdapter>,
) {
    val scope = rememberCoroutineScope()
    val language = state.language
    val order = state.selectedOrder
    val listState = rememberLazyListState()
    LaunchedEffect(order?.id) { listState.scrollToItem(0) }
    LazyColumn(state = listState, contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
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
                TextButton(onClick = { scope.launch { listState.animateScrollToItem(3 + maxOf(1, order.shipments.size)) } }) {
                    Text(language.text(Label.MANAGE_RETURNS))
                }
                Text(order.merchant, style = MaterialTheme.typography.headlineSmall)
                Text("${language.text(Label.DELIVERY_PROGRESS)}: ${language.progress(order.deliveryProgress)}")
                order.items.forEach { Text("${it.title} × ${it.quantity}") }
            }
            item(key = "address-${order.id}") { ShippingAddressCard(order.id, privateService, language) }
            item(key = "attach-${order.id}") { AttachShipmentForm(state, presenter, order, carriers) }
            if (order.shipments.isEmpty()) item { Text(language.text(Label.NO_SHIPMENTS)) }
            items(order.shipments, key = { it.id }) { shipment ->
                ShipmentCard(shipment, state, presenter, order, carrierSettings, carriers)
            }
            item(key = "returns-heading-${order.id}") { Text(language.text(Label.RETURNS), style = MaterialTheme.typography.headlineSmall) }
            item(key = "return-request-${order.id}") { ReturnRequestButton(order, state, presenter) }
            if (state.returns.isEmpty()) item { Text(language.text(Label.NO_RETURNS)) }
            items(state.returns, key = { "return-${it.id}" }) { record -> ReturnRecordCard(record, order, state, presenter) }
        }
    }
}

@Composable
private fun AttachShipmentForm(
    state: ShopSnapshot,
    presenter: ShopPresenter,
    order: PurchaseOrder,
    carriers: List<CarrierAdapter>,
) {
    val language = state.language
    val scope = rememberCoroutineScope()
    var tracking by remember(order.id) { mutableStateOf("") }
    var carrier by remember(order.id) { mutableStateOf("") }
    var carrierMode by remember(order.id) { mutableStateOf<String?>(null) }
    val allocated = order.shipments.flatMap { it.allocations }
        .groupBy { it.orderItemId }
        .mapValues { (_, values) -> values.sumOf { it.quantity } }
    val remaining = order.items.associate { it.id to it.quantity - (allocated[it.id] ?: 0) }
    var quantities by remember(order.id, order.shipments.size) {
        mutableStateOf(
            order.items.associate {
                it.id to (remaining[it.id]?.takeIf { left -> left > 0 }?.toString() ?: "")
            }.toMutableMap(),
        )
    }
    val allocations = quantities.mapNotNull { (id, value) ->
        value.toIntOrNull()?.takeIf { it > 0 }?.let { id to it }
    }
    val valid = tracking.isNotBlank() && carrier.isNotBlank() && allocations.isNotEmpty() &&
        allocations.all { (id, quantity) -> quantity <= (remaining[id] ?: 0) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(language.text(Label.PACKAGE_DETAILS), style = MaterialTheme.typography.titleSmall)
        if (carrierMode == null) {
            Text(language.text(Label.MANUAL_TRACKING), style = MaterialTheme.typography.bodySmall)
        }
        OutlinedTextField(tracking, { tracking = it }, label = { Text(language.text(Label.TRACKING_NUMBER)) }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(carrier, { carrier = it }, label = { Text(language.text(Label.CARRIER)) }, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = carrierMode == null,
                onClick = { carrierMode = null },
                label = { Text(language.text(Label.MANUAL_CARRIER)) },
            )
            carriers.forEach { adapter ->
                FilterChip(
                    selected = carrierMode == adapter.id,
                    onClick = { carrierMode = adapter.id; carrier = adapter.displayName },
                    label = { Text("${adapter.displayName} API") },
                )
            }
        }
        if (remaining.values.all { it <= 0 }) {
            Text(language.text(Label.ALL_ALLOCATED))
        } else {
            order.items.forEach { item ->
                val left = remaining[item.id] ?: 0
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${item.title} · ${language.text(Label.REMAINING)} $left", modifier = Modifier.weight(1f))
                    OutlinedTextField(
                        quantities[item.id].orEmpty(),
                        { value -> quantities = quantities.toMutableMap().also { it[item.id] = value } },
                        label = { Text(language.text(Label.QUANTITY)) },
                        modifier = Modifier.width(92.dp),
                        enabled = left > 0,
                    )
                }
            }
        }
        Button(enabled = valid && !state.busy, onClick = {
            scope.launch {
                presenter.attachShipment(tracking, carrier, allocations, carrierMode)
                if (presenter.state.value.error == null) {
                    tracking = ""
                    carrier = ""
                    carrierMode = null
                    quantities = order.items.associate { it.id to "" }.toMutableMap()
                }
            }
        }) { Text(language.text(Label.ATTACH_SHIPMENT)) }
    }
}


@Composable
private fun ShipmentCard(
    shipment: Shipment,
    state: ShopSnapshot,
    presenter: ShopPresenter,
    order: PurchaseOrder,
    carrierSettings: CarrierSettings,
    carriers: List<CarrierAdapter>,
) {
    val scope = rememberCoroutineScope()
    val language = state.language
    val label = state.shipmentLabels[shipment.id]
    val adapter = carriers.firstOrNull { it.id == shipment.carrierId }
    var message by remember(shipment.id) { mutableStateOf<String?>(null) }
    var description by remember(shipment.id) { mutableStateOf("") }
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("${label?.carrierLabel.orEmpty()} · ${label?.trackingNumber.orEmpty()}", style = MaterialTheme.typography.titleMedium)
            shipment.allocations.forEach { allocation ->
                val title = order.items.firstOrNull { it.id == allocation.orderItemId }?.title ?: allocation.orderItemId
                Text("$title × ${allocation.quantity}")
            }
            Text(when {
                shipment.status == ShipmentStatus.DELIVERED -> language.text(Label.DELIVERED)
                shipment.status == ShipmentStatus.IN_TRANSIT -> language.text(Label.IN_TRANSIT)
                adapter != null -> language.text(Label.CARRIER_TRACKING)
                else -> language.text(Label.MANUAL_TRACKING)
            })
            if (adapter != null) {
                OutlinedButton(enabled = !state.busy && label != null, onClick = {
                    scope.launch {
                        message = null
                        val trackingNumber = label?.trackingNumber
                        if (trackingNumber == null) {
                            message = language.text(Label.CARRIER_NOT_CONFIGURED)
                            return@launch
                        }
                        val key = runCatching {
                            withContext(Dispatchers.Default) {
                                if (adapter.id == CarrierSettings.THAILAND_POST) carrierSettings.thailandPostApiKey() else null
                            }
                        }.getOrNull()
                        if (key == null) {
                            message = language.text(Label.CARRIER_NOT_CONFIGURED)
                            return@launch
                        }
                        when (val result = adapter.track(trackingNumber, CarrierCredentials(key))) {
                            is CarrierResult.Success -> {
                                presenter.recordCarrierEvents(shipment.id, adapter.id, result.tracking.events)
                                if (presenter.state.value.error == null) {
                                    message = language.text(Label.TRACKING_UPDATED)
                                }
                            }
                            is CarrierResult.Failure -> message = result.failure.message
                        }
                    }
                }) { Text("${language.text(Label.REFRESH_TRACKING)} · ${adapter.displayName}") }
            }
            message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
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
                val provider = event.method == ObservationMethod.PROVIDER
                val sourceLabel = if (provider) "${adapter?.displayName ?: "Carrier"} ${language.text(Label.CARRIER_EVENT)}"
                    else language.text(Label.MANUAL_EVENT)
                val whenText = event.originalTimestamp?.let { "$it ${event.originalTimezone.orEmpty()}" }
                    ?: Instant.fromEpochMilliseconds(event.occurredAtEpochMillis ?: event.importedAtEpochMillis)
                Text("$sourceLabel · $whenText", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun ShippingAddressCard(orderId: String, service: OrderPrivateService, language: AppLanguage) {
    val scope = rememberCoroutineScope()
    var address by remember(orderId) { mutableStateOf("") }
    var error by remember(orderId) { mutableStateOf<String?>(null) }
    var saved by remember(orderId) { mutableStateOf(true) }
    LaunchedEffect(orderId) {
        runCatching { withContext(Dispatchers.Default) {
            service.read(orderId, OrderPrivateService.SHIPPING_ADDRESS)
        } }.onSuccess { address = it.orEmpty() }.onFailure { error = it.message }
    }
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(language.text(Label.SHIPPING_ADDRESS), style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(address, { address = it; saved = false }, label = {
                Text(language.text(Label.ADDRESS))
            }, modifier = Modifier.fillMaxWidth())
            Text(language.text(Label.ADDRESS_HINT), style = MaterialTheme.typography.bodySmall)
            error?.let { Text("${language.text(Label.ADDRESS_UNAVAILABLE)} ${it.orEmpty()}", color = MaterialTheme.colorScheme.error) }
            Button(enabled = !saved, onClick = {
                scope.launch {
                    runCatching { withContext(Dispatchers.Default) {
                        service.save(orderId, OrderPrivateService.SHIPPING_ADDRESS, address)
                    } }.onSuccess { saved = true; error = null }.onFailure { error = it.message }
                }
            }) { Text(language.text(Label.SAVE_ADDRESS)) }
        }
    }
}
