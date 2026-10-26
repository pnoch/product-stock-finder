package com.omnishop.app

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.omnishop.connectors.externalSearchUrl
import com.omnishop.connectors.validatedBookmarkUrl
import com.omnishop.core.ShoppingSources
import kotlinx.coroutines.launch
import com.omnishop.app.resources.Res
import com.omnishop.app.resources.omnishop
import org.jetbrains.compose.resources.painterResource

private val destinations = listOf(Label.DISCOVER, Label.SEARCH, Label.SAVED, Label.ORDERS, Label.PROFILE)

@Composable
fun OmniShopApp(
    presenter: ShopPresenter,
    backup: com.omnishop.data.BackupService,
    privateService: com.omnishop.data.OrderPrivateService,
    carrierSettings: com.omnishop.data.CarrierSettings,
    carriers: List<com.omnishop.carriers.CarrierAdapter>,
    files: BackupFiles,
    openUrl: (String) -> Unit,
) {
    val state by presenter.state.collectAsState()
    val scope = rememberCoroutineScope()
    var tab by remember { mutableStateOf(Label.DISCOVER) }
    var externalError by remember { mutableStateOf<String?>(null) }
    val language = state.language
    LaunchedEffect(presenter) { presenter.refresh() }
    val open: (String) -> Unit = { raw ->
        runCatching { openUrl(validatedBookmarkUrl(raw)) }
            .onFailure { externalError = it.message ?: "Could not open the link" }
    }

    MaterialTheme(colorScheme = lightColorScheme(primary = Color(0xFF0F52BA), secondary = Color(0xFF008568))) {
        Surface(Modifier.fillMaxSize()) {
            BoxWithConstraints {
                val wide = maxWidth >= 840.dp
                Row(Modifier.fillMaxSize()) {
                    if (wide) NavigationRail {
                        destinations.forEach { destination ->
                            NavigationRailItem(
                                selected = tab == destination,
                                onClick = { tab = destination },
                                icon = { Text(language.text(destination).take(1)) },
                                label = { Text(language.text(destination)) },
                            )
                        }
                    }
                    Column(Modifier.weight(1f)) {
                        Column(Modifier.padding(horizontal = 20.dp, vertical = 12.dp)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Image(painterResource(Res.drawable.omnishop), "OmniShop", Modifier.size(44.dp))
                                Text("OmniShop", style = MaterialTheme.typography.headlineMedium)
                            }
                            Text(language.text(Label.FREE_TO_START), style = MaterialTheme.typography.bodyMedium)
                            if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
                            (state.error ?: externalError)?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                        }
                        Box(Modifier.weight(1f).fillMaxWidth()) {
                            when (tab) {
                                Label.DISCOVER -> SourceScreen(language, open)
                                Label.SEARCH -> SearchScreen(language, open)
                                Label.SAVED -> SavedScreen(state, presenter, open) { tab = Label.ORDERS }
                                Label.ORDERS -> OrdersScreen(state, presenter, privateService, carrierSettings, carriers)
                                Label.PROFILE -> Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                    Text(language.text(Label.LOCAL_FIRST))
                                    Text(language.text(Label.NATIVE_PREVIEW), style = MaterialTheme.typography.titleMedium)
                                    Text(language.text(Label.NO_LIVE_API))
                                    Text("${language.text(Label.LANGUAGE)} · THB")
                                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        AppLanguage.entries.forEach { option ->
                                            FilterChip(
                                                selected = option == language,
                                                onClick = { scope.launch { presenter.changeLanguage(option) } },
                                                label = { Text(if (option == AppLanguage.THAI) "ไทย" else "English") },
                                            )
                                        }
                                    }
                                    CarrierSettingsPanel(language, carrierSettings)
                                    BackupPanel(language, backup, files) { scope.launch { presenter.refresh() } }
                                }
                                else -> Unit
                            }
                        }
                        if (!wide) NavigationBar {
                            destinations.forEach { destination ->
                                NavigationBarItem(
                                    selected = tab == destination,
                                    onClick = { tab = destination },
                                    icon = { Text(language.text(destination).take(1)) },
                                    label = { Text(language.text(destination)) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SourceScreen(language: AppLanguage, open: (String) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text(language.text(Label.DISCOVER), style = MaterialTheme.typography.headlineSmall) }
        items(ShoppingSources.initial, key = { it.id }) { source ->
            OutlinedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(source.id, style = MaterialTheme.typography.titleMedium)
                    Text("${language.text(Label.EXTERNAL_ONLY)} · ${language.text(Label.LINK_ONLY)}")
                    TextButton(onClick = { open(externalSearchUrl(source.id, "shopping")) }) {
                        Text(language.text(Label.OPEN_SEARCH))
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchScreen(language: AppLanguage, open: (String) -> Unit) {
    var query by remember { mutableStateOf("") }
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            OutlinedTextField(query, { query = it }, label = { Text(language.text(Label.KEYWORDS)) }, modifier = Modifier.fillMaxWidth())
        }
        items(ShoppingSources.initial, key = { it.id }) { source ->
            OutlinedButton(onClick = { open(externalSearchUrl(source.id, query)) }, enabled = query.isNotBlank() && query.length <= 500) {
                Text("${source.id} · ${language.text(Label.OPEN_SEARCH)}")
            }
        }
    }
}
