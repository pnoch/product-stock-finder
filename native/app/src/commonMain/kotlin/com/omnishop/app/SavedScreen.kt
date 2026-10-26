package com.omnishop.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Alignment
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.omnishop.data.SavedProduct
import com.omnishop.core.Cost
import com.omnishop.core.decimalString
import kotlinx.coroutines.launch

@Composable
internal fun SavedScreen(state: ShopSnapshot, presenter: ShopPresenter, open: (String) -> Unit, showOrders: () -> Unit) {
    val language = state.language
    val scope = rememberCoroutineScope()
    var title by remember { mutableStateOf("") }
    var url by remember { mutableStateOf("") }
    var purchasing by remember { mutableStateOf<SavedProduct?>(null) }
    var comparing by remember { mutableStateOf<SavedProduct?>(null) }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(title, { title = it }, label = { Text(language.text(Label.TITLE)) }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(url, { url = it }, label = { Text(language.text(Label.PRODUCT_LINK)) }, modifier = Modifier.fillMaxWidth())
                Button(enabled = title.isNotBlank() && !state.busy, onClick = {
                    scope.launch {
                        presenter.saveProduct(title, url)
                        if (presenter.state.value.error == null) { title = ""; url = "" }
                    }
                }) { Text(language.text(Label.SAVE)) }
            }
        }
        if (state.products.isEmpty()) item { Text(language.text(Label.EMPTY_SAVED)) }
        items(state.products, key = { it.id }) { product ->
            OutlinedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(product.title, style = MaterialTheme.typography.titleMedium)
                    Text(language.text(Label.METADATA_UNAVAILABLE))
                    product.sourceUrl?.let { link -> TextButton(onClick = { open(link) }) { Text(link) } }
                    state.offers[product.id].orEmpty().forEach { offer ->
                        Text("${offer.sourceLabel}: ${offer.estimate.itemPrice.decimalString()} THB")
                        Text((offer.estimate.shipping as? Cost.Known)?.let { "${language.text(Label.SHIPPING_THB)}: ${it.amount.decimalString()}" }
                            ?: language.text(Label.UNKNOWN_SHIPPING))
                    }
                    if (state.offers[product.id].orEmpty().isNotEmpty()) {
                        Text(language.text(Label.UNKNOWN_FEES), style = MaterialTheme.typography.bodySmall)
                    }
                    OutlinedButton(onClick = { comparing = product }) { Text(language.text(Label.ADD_OFFER)) }
                    Button(onClick = { purchasing = product }) { Text(language.text(Label.CREATE_ORDER)) }
                }
            }
        }
    }
    comparing?.let { product ->
        OfferDialog(product, state, presenter) { comparing = null }
    }
    purchasing?.let { product ->
        var merchant by remember(product.id) { mutableStateOf("") }
        var merchantOrderId by remember(product.id) { mutableStateOf("") }
        var rows by remember(product.id) { mutableStateOf(listOf(OrderDraft(product.title, "1", ""))) }
        val valid = merchant.isNotBlank() && rows.isNotEmpty() && rows.all {
            it.title.isNotBlank() && (it.quantity.toIntOrNull() ?: 0) > 0
        }
        AlertDialog(
            onDismissRequest = { purchasing = null },
            title = { Text(language.text(Label.CREATE_ORDER)) },
            text = {
                Column(
                    Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedTextField(merchant, { merchant = it }, label = { Text(language.text(Label.MERCHANT)) }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(merchantOrderId, { merchantOrderId = it }, label = { Text(language.text(Label.MERCHANT_ORDER_ID)) }, modifier = Modifier.fillMaxWidth())
                    rows.forEachIndexed { index, row ->
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                row.title,
                                { value -> rows = rows.toMutableList().also { it[index] = row.copy(title = value) } },
                                label = { Text(language.text(Label.ITEM_TITLE)) },
                                modifier = Modifier.weight(1f),
                            )
                            OutlinedTextField(
                                row.quantity,
                                { value -> rows = rows.toMutableList().also { it[index] = row.copy(quantity = value) } },
                                label = { Text(language.text(Label.QUANTITY)) },
                                modifier = Modifier.width(76.dp),
                            )
                            OutlinedTextField(
                                row.unitPrice,
                                { value -> rows = rows.toMutableList().also { it[index] = row.copy(unitPrice = value) } },
                                label = { Text(language.text(Label.PRICE_THB)) },
                                modifier = Modifier.width(112.dp),
                            )
                            if (rows.size > 1) {
                                TextButton(onClick = { rows = rows.filterIndexed { i, _ -> i != index } }) {
                                    Text("×")
                                }
                            }
                        }
                    }
                    TextButton(onClick = { rows = rows + OrderDraft("", "1", "") }) {
                        Text(language.text(Label.ADD_ITEM))
                    }
                }
            },
            confirmButton = {
                TextButton(enabled = valid && !state.busy, onClick = {
                    scope.launch {
                        presenter.createOrder(
                            merchant,
                            rows.map { DraftItem(it.title.trim(), it.quantity.toIntOrNull() ?: 0, it.unitPrice) },
                            merchantOrderId,
                        )
                        if (presenter.state.value.error == null) { purchasing = null; showOrders() }
                    }
                }) { Text(language.text(Label.SAVE)) }
            },
            dismissButton = { TextButton(onClick = { purchasing = null }) { Text(language.text(Label.CANCEL)) } },
        )
    }
}

@Composable
private fun OfferDialog(product: SavedProduct, state: ShopSnapshot, presenter: ShopPresenter, close: () -> Unit) {
    val scope = rememberCoroutineScope()
    val language = state.language
    var source by remember(product.id) { mutableStateOf("") }
    var price by remember(product.id) { mutableStateOf("") }
    var shipping by remember(product.id) { mutableStateOf("") }
    AlertDialog(onDismissRequest = close,
        title = { Text(language.text(Label.ADD_OFFER)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(product.title)
                Text(language.text(Label.MANUAL_OFFER))
                OutlinedTextField(source, { source = it }, label = { Text(language.text(Label.MERCHANT)) })
                OutlinedTextField(price, { price = it }, label = { Text(language.text(Label.PRICE_THB)) })
                OutlinedTextField(shipping, { shipping = it }, label = { Text(language.text(Label.SHIPPING_THB)) })
            }
        },
        confirmButton = { TextButton(enabled = source.isNotBlank() && price.isNotBlank() && !state.busy, onClick = {
            scope.launch {
                presenter.addOffer(product.id, source, price, shipping)
                if (presenter.state.value.error == null) close()
            }
        }) { Text(language.text(Label.SAVE)) } },
        dismissButton = { TextButton(onClick = close) { Text(language.text(Label.CANCEL)) } },
    )
}

private data class OrderDraft(val title: String, val quantity: String, val unitPrice: String)
