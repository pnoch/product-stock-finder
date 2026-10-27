package com.omnishop.app

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.omnishop.data.SyncDiscoveredPeer
import com.omnishop.data.SyncPairingCode
import com.omnishop.data.SyncResult
import com.omnishop.data.SyncService
import io.github.alexzhirkevich.qrose.rememberQrCodePainter
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.time.Instant

@Composable
internal fun DevicesPanel(
    language: AppLanguage,
    service: SyncService,
    scanPairingCode: (((String) -> Unit) -> Unit)? = null,
) {
    val scope = rememberCoroutineScope()
    val reason = service.unavailableReason
    var refresh by remember { mutableStateOf(0) }
    var pairing by remember { mutableStateOf<SyncPairingCode?>(null) }
    var joinCode by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    var discovered by remember { mutableStateOf(emptyList<SyncDiscoveredPeer>()) }
    var nearbyTarget by remember { mutableStateOf<SyncDiscoveredPeer?>(null) }
    var nearbySecret by remember { mutableStateOf("") }
    val peers = remember(refresh) { service.peers() }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(language.text(Label.DEVICES), style = MaterialTheme.typography.titleMedium)
        Text(language.text(Label.PEER_SYNC_NOTE), style = MaterialTheme.typography.bodySmall)
        if (reason != null) {
            Text(reason, color = MaterialTheme.colorScheme.error)
            return@Column
        }
        LaunchedEffect(Unit) {
            while (true) {
                delay(2_000)
                discovered = service.discoveredPeers()
                refresh++
            }
        }
        Text("${language.text(Label.THIS_DEVICE)} · ${service.thisDevice().deviceId.take(16)}…", style = MaterialTheme.typography.bodyMedium)
        OutlinedButton(enabled = !working, onClick = {
            working = true
            scope.launch {
                runCatching { service.createPairing() }
                    .onSuccess { pairing = it; message = null }
                    .onFailure { message = "${language.text(Label.PAIR_FAILED)} ${it.message}" }
                working = false
            }
        }) { Text(language.text(Label.PAIR_DEVICE)) }
        pairing?.let { code ->
            Text(language.text(Label.PAIRING_CODE), style = MaterialTheme.typography.bodyMedium)
            SelectionContainer {
                Text(code.code, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
            }
            Image(
                rememberQrCodePainter(code.code),
                contentDescription = "Pairing QR code",
                modifier = Modifier.size(220.dp),
            )
            code.secret?.let {
                Text(
                    "${language.text(Label.PAIRING_SECRET)}: $it",
                    fontFamily = FontFamily.Monospace,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Text(
                "${language.text(Label.PAIRING_CODE_HINT)} ${Instant.fromEpochMilliseconds(code.expiresAtEpochMillis)}",
                style = MaterialTheme.typography.bodySmall,
            )
        }
        OutlinedTextField(
            joinCode,
            { joinCode = it },
            label = { Text(language.text(Label.JOIN_WITH_CODE)) },
            modifier = Modifier.fillMaxWidth(),
        )
        if (scanPairingCode != null) {
            OutlinedButton(enabled = !working, onClick = {
                scanPairingCode { scanned -> joinCode = scanned }
            }) { Text(language.text(Label.SCAN_QR)) }
        }
        Button(enabled = joinCode.isNotBlank() && !working, onClick = {
            working = true
            scope.launch {
                when (val result = service.pair(joinCode.trim())) {
                    is SyncResult.Success -> {
                        message = language.text(Label.PAIRED) + (result.sas?.let { " SAS $it" } ?: "")
                        joinCode = ""
                        refresh++
                    }
                    is SyncResult.Failure -> message = "${language.text(Label.PAIR_FAILED)} ${result.message}"
                }
                working = false
            }
        }) { Text(language.text(Label.PAIR)) }
        Text(language.text(Label.PAIRED_DEVICES), style = MaterialTheme.typography.titleSmall)
        if (peers.isEmpty()) Text(language.text(Label.NO_PEERS))
        peers.forEach { peer ->
            OutlinedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(peer.displayName, style = MaterialTheme.typography.bodyLarge)
                    Text("${language.text(Label.DEVICE_ID)}: ${peer.deviceId.take(16)}…", style = MaterialTheme.typography.bodySmall)
                    peer.sas?.let { Text("SAS: $it", style = MaterialTheme.typography.bodySmall) }
                    Text("${language.text(Label.LAST_SYNC)}: ${Instant.fromEpochMilliseconds(peer.lastSyncAtEpochMillis)}", style = MaterialTheme.typography.bodySmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(enabled = !working, onClick = {
                            working = true
                            scope.launch {
                                when (val result = service.sync(peer.deviceId)) {
                                    is SyncResult.Success -> {
                                        message = "${language.text(Label.SYNC_DONE)} ${result.applied}"
                                        refresh++
                                    }
                                    is SyncResult.Failure -> message = "${language.text(Label.SYNC_FAILED)} ${result.message}"
                                }
                                working = false
                            }
                        }) { Text(language.text(Label.SYNC_NOW)) }
                        TextButton(enabled = !working, onClick = {
                            service.revoke(peer.deviceId)
                            message = null
                            refresh++
                        }) { Text(language.text(Label.REVOKE)) }
                    }
                }
            }
        }
        Text(language.text(Label.NEARBY_DEVICES), style = MaterialTheme.typography.titleSmall)
        if (discovered.isEmpty()) Text(language.text(Label.NO_NEARBY_DEVICES), style = MaterialTheme.typography.bodySmall)
        discovered.forEach { peer ->
            OutlinedCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(peer.displayName, style = MaterialTheme.typography.bodyLarge)
                    Text(peer.endpoint, style = MaterialTheme.typography.bodySmall)
                    TextButton(enabled = !working, onClick = {
                        nearbyTarget = peer
                        nearbySecret = ""
                    }) { Text(language.text(Label.JOIN_NEARBY)) }
                }
            }
        }
        nearbyTarget?.let { peer ->
            Text("${language.text(Label.JOIN_NEARBY)} · ${peer.displayName}", style = MaterialTheme.typography.bodyMedium)
            OutlinedTextField(
                nearbySecret,
                { nearbySecret = it },
                label = { Text(language.text(Label.PAIRING_SECRET)) },
                modifier = Modifier.fillMaxWidth(),
            )
            Button(enabled = nearbySecret.isNotBlank() && !working, onClick = {
                working = true
                scope.launch {
                    when (val result = service.pairDiscovered(peer.deviceId, nearbySecret.trim())) {
                        is SyncResult.Success -> {
                            message = language.text(Label.PAIRED) + (result.sas?.let { " SAS $it" } ?: "")
                            nearbyTarget = null
                            nearbySecret = ""
                            refresh++
                        }
                        is SyncResult.Failure -> message = "${language.text(Label.PAIR_FAILED)} ${result.message}"
                    }
                    working = false
                }
            }) { Text(language.text(Label.JOIN_NEARBY)) }
            TextButton(enabled = !working, onClick = {
                nearbyTarget = null
                nearbySecret = ""
            }) { Text("Cancel") }
        }
        message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        if (working) LinearProgressIndicator(Modifier.fillMaxWidth())
    }
}
