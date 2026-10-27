package com.omnishop.sync

import com.omnishop.data.SyncDiscoveredPeer
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap
import javax.jmdns.JmDNS
import javax.jmdns.ServiceEvent
import javax.jmdns.ServiceInfo
import javax.jmdns.ServiceListener

internal class MdnsDiscovery(
    private val deviceId: String,
    private val displayName: String,
    private val fingerprint: String,
    private val port: Int,
    private val now: () -> Long,
) : AutoCloseable {
    private val services = ConcurrentHashMap<String, SyncDiscoveredPeer>()
    private val jmdns = runCatching {
        lanAddress()?.let { JmDNS.create(it) } ?: JmDNS.create()
    }.getOrNull()
    private var advertised: ServiceInfo? = null

    init {
        jmdns?.addServiceListener(TYPE, object : ServiceListener {
            override fun serviceAdded(event: ServiceEvent) {
                jmdns.requestServiceInfo(event.type, event.name, true, 1_000)
            }

            override fun serviceRemoved(event: ServiceEvent) {
                services.remove(event.name)
            }

            override fun serviceResolved(event: ServiceEvent) {
                resolve(event.info)?.let { services[event.name] = it }
            }
        })
    }

    fun advertise(expiresAtEpochMillis: Long) {
        val jm = jmdns ?: return
        stopAdvertising()
        val info = ServiceInfo.create(
            TYPE,
            "$deviceId.$TYPE",
            port,
            0,
            0,
            mapOf(
                "v" to "1",
                "id" to deviceId,
                "fp" to fingerprint,
                "name" to displayName,
                "expires" to expiresAtEpochMillis.toString(),
            ),
        )
        runCatching { jm.registerService(info) }.onSuccess { advertised = info }
    }

    fun stopAdvertising() {
        advertised?.let { info -> runCatching { jmdns?.unregisterService(info) } }
        advertised = null
    }

    fun peers(): List<SyncDiscoveredPeer> = services.values.filter {
        it.deviceId != deviceId && it.pairingExpiresAtEpochMillis > now()
    }

    override fun close() {
        stopAdvertising()
        runCatching { jmdns?.close() }
    }

    private fun resolve(info: ServiceInfo?): SyncDiscoveredPeer? {
        if (info == null) return null
        val host = info.inetAddresses.firstOrNull { it is Inet4Address }?.hostAddress
            ?: info.hostAddresses.firstOrNull()
            ?: return null
        return parsePeer(
            mapOf(
                "id" to info.getPropertyString("id").orEmpty(),
                "fp" to info.getPropertyString("fp").orEmpty(),
                "name" to info.getPropertyString("name").orEmpty(),
                "expires" to info.getPropertyString("expires").orEmpty(),
            ),
            host,
            info.port,
            now(),
        )
    }

    private fun lanAddress(): InetAddress? {
        val interfaces = NetworkInterface.getNetworkInterfaces() ?: return null
        Collections.list(interfaces).forEach { network ->
            if (!network.isUp || network.isLoopback) return@forEach
            Collections.list(network.inetAddresses).forEach { address ->
                if (address is Inet4Address && address.isSiteLocalAddress) return address
            }
        }
        return null
    }

    companion object {
        const val TYPE = "_omnishop._tcp.local."

        internal fun parsePeer(
            props: Map<String, String>,
            host: String,
            port: Int,
            now: Long,
        ): SyncDiscoveredPeer? {
            if (host.isBlank() || port !in 1..65535) return null
            val id = props["id"]?.takeIf { it.isNotBlank() } ?: return null
            val fingerprint = props["fp"]?.takeIf { it.isNotBlank() } ?: return null
            val expires = props["expires"]?.toLongOrNull() ?: return null
            if (expires <= now) return null
            return SyncDiscoveredPeer(
                deviceId = id,
                displayName = props["name"]?.takeIf { it.isNotBlank() } ?: "Device",
                endpoint = "$host:$port",
                fingerprint = fingerprint,
                pairingExpiresAtEpochMillis = expires,
            )
        }
    }
}
