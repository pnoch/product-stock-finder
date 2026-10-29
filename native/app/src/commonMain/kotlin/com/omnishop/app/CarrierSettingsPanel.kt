package com.omnishop.app

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.omnishop.data.CarrierSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
internal fun CarrierSettingsPanel(language: AppLanguage, settings: CarrierSettings) {
    val scope = rememberCoroutineScope()
    var configured by remember { mutableStateOf(false) }
    var key by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    LaunchedEffect(settings) {
        configured = runCatching {
            withContext(Dispatchers.Default) { settings.isThailandPostConfigured() }
        }.getOrDefault(false)
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(language.text(Label.CARRIER_CONNECTION), style = MaterialTheme.typography.titleMedium)
        Text(
            "Thailand Post · TrackingMore · ${language.text(if (configured) Label.CONFIGURED else Label.NOT_CONFIGURED)}",
            style = MaterialTheme.typography.bodyMedium,
        )
        OutlinedTextField(
            value = key,
            onValueChange = { if (it.length <= 512) key = it },
            label = { Text(language.text(Label.THAILAND_POST_API_KEY)) },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(enabled = key.isNotBlank() && !working, onClick = {
                working = true
                scope.launch {
                    runCatching {
                        withContext(Dispatchers.Default) { settings.setThailandPostApiKey(key) }
                    }.onSuccess {
                        key = ""
                        configured = true
                        message = language.text(Label.API_KEY_SAVED)
                    }.onFailure { message = it.message }
                    working = false
                }
            }) { Text(language.text(Label.SAVE)) }
            if (configured) {
                TextButton(enabled = !working, onClick = {
                    working = true
                    scope.launch {
                        runCatching {
                            withContext(Dispatchers.Default) { settings.clearThailandPostApiKey() }
                        }.onSuccess {
                            configured = false
                            message = language.text(Label.API_KEY_CLEARED)
                        }.onFailure { message = it.message }
                        working = false
                    }
                }) { Text(language.text(Label.API_KEY_CLEAR)) }
            }
        }
        message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        Text(language.text(Label.API_KEY_HINT), style = MaterialTheme.typography.bodySmall)
    }
}
