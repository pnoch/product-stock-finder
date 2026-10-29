package com.omnishop.sync

import com.omnishop.data.*
import com.omnishop.data.security.BackupCrypto
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.math.BigInteger
import java.net.Inet4Address
import java.net.NetworkInterface
import java.net.Socket
import java.net.SocketException
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.SecureRandom
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.util.Base64
import java.util.Collections
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLServerSocket
import javax.net.ssl.SSLSocket
import javax.net.ssl.X509TrustManager
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.concurrent.thread
import kotlin.time.Clock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.bouncycastle.asn1.x500.X500Name
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder

/**
 * JVM peer sync (desktop + Android) over mutually authenticated TLS with
 * certificate pinning and SAS confirmation. iOS uses [UnavailableSyncService]
 * until its Network.framework transport lands. This is not a cloud service and
 * creates no account.
 */
class TlsSyncService(
    private val store: ShoppingStore,
    private val secrets: SecretStore,
    private val crypto: BackupCrypto,
    receipts: ReceiptService? = null,
    private val displayName: String = "Desktop",
    enableDiscovery: Boolean = true,
    enableServer: Boolean = true,
    port: Int = DEFAULT_PORT,
    private val advertisedHost: String? = null,
    private val now: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) : SyncService {
    private val identity = loadOrCreateIdentity()
    private val engine = SyncEngine(store, receipts)
    private val server: SSLServerSocket?
    private val discovery: MdnsDiscovery?
    private val serverThread: Thread?
    private var pairingSecret: String? = null
    private var pairingExpiresAt: Long = 0

    init {
        store.setOriginDevice(identity.deviceId)
        if (enableServer) {
            val context = serverContext(identity)
            server = context.serverSocketFactory.createServerSocket(port) as SSLServerSocket
            server.needClientAuth = true
            server.soTimeout = 2_000
            server.reuseAddress = true
        } else {
            server = null
        }
        discovery = if (enableDiscovery && server != null) {
            runCatching {
                MdnsDiscovery(identity.deviceId, displayName, identity.fingerprint, requireNotNull(server).localPort, now)
            }.getOrNull()
        } else {
            null
        }
        serverThread = if (server != null) {
            thread(isDaemon = true, name = "omnishop-sync-server") { acceptLoop() }
        } else {
            null
        }
    }

    override fun thisDevice(): SyncDeviceInfo =
        SyncDeviceInfo(identity.deviceId, displayName, identity.fingerprint)

    override fun peers(): List<SyncPeerInfo> = loadPeers().map {
        SyncPeerInfo(it.deviceId, it.displayName, it.endpoint, it.lastSyncAt, it.sas)
    }

    override fun discoveredPeers(): List<SyncDiscoveredPeer> = discovery?.peers() ?: emptyList()

    override suspend fun createPairing(): SyncPairingCode {
        val secret = Base64.getUrlEncoder().withoutPadding().encodeToString(crypto.randomBytes(16))
        val expires = now() + PAIRING_LIFETIME_MILLIS
        pairingSecret = secret
        pairingExpiresAt = expires
        val payload = PairingPayload(
            VERSION, identity.deviceId, identity.fingerprint, advertisedHost ?: lanHost(),
            server?.localPort ?: error("Pairing server is unavailable"), secret, expires,
        )
        val code = Base64.getUrlEncoder().withoutPadding().encodeToString(
            json.encodeToString(PairingPayload.serializer(), payload).encodeToByteArray(),
        )
        discovery?.advertise(expires)
        return SyncPairingCode(code, expires, secret)
    }

    override suspend fun pair(code: String): SyncResult = withContext(Dispatchers.IO) {
        runCatching {
        val payload = json.decodeFromString(
            PairingPayload.serializer(),
            Base64.getUrlDecoder().decode(code).decodeToString(),
        )
        require(payload.version == VERSION) { "Unsupported pairing code" }
        require(payload.expiresAt > now()) { "Pairing code expired" }
        val socket = connect(payload.host, payload.port, payload.fingerprint)
        socket.use {
            send(it, WireMessage(
                type = "pair", secret = payload.secret, deviceId = identity.deviceId,
                name = displayName, fingerprint = identity.fingerprint,
            ))
            val response = receive(it)
            require(response.type == "paired") { response.message ?: "Pairing rejected" }
            val deviceId = requireNotNull(response.deviceId)
            val fingerprint = requireNotNull(response.fingerprint)
            val sas = sas(payload.secret, payload.fingerprint, identity.fingerprint)
            require(response.sas == sas) { "SAS mismatch" }
            savePeer(StoredPeer(
                deviceId, response.name ?: "Device", "${payload.host}:${payload.port}",
                fingerprint, now(), sas,
            ))
            return@runCatching SyncResult.Success(applied = 0, sent = 0, sas = sas)
        }
        SyncResult.Success(applied = 0, sent = 0)
        }.getOrElse { SyncResult.Failure(it.message ?: "Pairing failed") }
    }

    override suspend fun pairDiscovered(peerId: String, secret: String): SyncResult {
        val peer = discoveredPeers().firstOrNull { it.deviceId == peerId }
            ?: return SyncResult.Failure("Nearby device not found")
        val host = peer.endpoint.substringBeforeLast(':')
        val port = peer.endpoint.substringAfterLast(':').toIntOrNull() ?: return SyncResult.Failure("Invalid device endpoint")
        val payload = PairingPayload(
            VERSION, peer.deviceId, peer.fingerprint, host, port,
            secret.trim(), peer.pairingExpiresAtEpochMillis,
        )
        val code = Base64.getUrlEncoder().withoutPadding().encodeToString(
            json.encodeToString(PairingPayload.serializer(), payload).encodeToByteArray(),
        )
        return pair(code)
    }

    override suspend fun sync(peerId: String): SyncResult = withContext(Dispatchers.IO) {
        runCatching {
        val peer = loadPeers().firstOrNull { it.deviceId == peerId }
            ?: error("Paired device not found")
        var localCursor = SyncCursor.START
        var remoteCursor = SyncCursor.START
        var applied = 0
        var sent = 0
        var completed: SyncResult? = null
        for (page in 0 until MAX_SYNC_PAGES) {
            val local = limitedBatch(localCursor)
            val connection = connectFromEndpoint(peer.endpoint, peer.fingerprint)
            connection.use {
                send(it, WireMessage(type = "sync", deviceId = identity.deviceId, batch = local, cursor = remoteCursor))
                val response = receive(it)
                require(response.type == "sync") { response.message ?: "Sync rejected" }
                val remote = requireNotNull(response.batch)
                applied += engine.apply(remote.changes)
                sent += local.changes.size
                val localDone = local.changes.isEmpty() && local.cursor == localCursor
                val remoteDone = remote.changes.isEmpty() && remote.cursor == remoteCursor
                localCursor = local.cursor
                remoteCursor = remote.cursor
                if (localDone && remoteDone) {
                    savePeer(peer.copy(lastSyncAt = now()))
                    completed = SyncResult.Success(applied, sent)
                    break
                }
            }
        }
        completed ?: error("Sync did not converge")
        }.getOrElse { SyncResult.Failure(it.message ?: "Sync failed") }
    }

    override fun revoke(peerId: String) {
        savePeers(loadPeers().filterNot { it.deviceId == peerId })
    }

    override fun close() {
        pairingSecret = null
        discovery?.close()
        runCatching { server?.close() }
        serverThread?.join(1_000)
    }

    private fun acceptLoop() {
        val listener = server ?: return
        while (!listener.isClosed) {
            try {
                (listener.accept() as SSLSocket).use(::handle)
            } catch (_: SocketException) {
                return
            } catch (_: Exception) {
                // Keep serving other peers; malformed connections are isolated.
            }
        }
    }

    private fun handle(socket: SSLSocket) {
        socket.soTimeout = 15_000
        socket.startHandshake()
        val message = receive(socket)
        when (message.type) {
            "pair" -> {
                val secret = pairingSecret
                if (secret == null || now() > pairingExpiresAt || message.secret != secret) {
                    send(socket, WireMessage(type = "error", message = "Pairing code rejected"))
                    return
                }
                val clientCertificate = socket.session.peerCertificates.first() as X509Certificate
                val clientFingerprint = fingerprint(clientCertificate)
                require(message.fingerprint == clientFingerprint) { "Client fingerprint mismatch" }
                val deviceId = requireNotNull(message.deviceId)
                val sas = sas(secret, identity.fingerprint, clientFingerprint)
                savePeer(StoredPeer(
                    deviceId, message.name ?: "Device",
                    "${socket.inetAddress.hostAddress}:0", clientFingerprint, now(), sas,
                ))
                pairingSecret = null
                discovery?.stopAdvertising()
                send(socket, WireMessage(
                    type = "paired", deviceId = identity.deviceId, name = displayName,
                    fingerprint = identity.fingerprint, sas = sas,
                ))
            }
            "sync" -> {
                val clientCertificate = socket.session.peerCertificates.first() as X509Certificate
                val clientFingerprint = fingerprint(clientCertificate)
                val peer = loadPeers().firstOrNull { it.fingerprint == clientFingerprint }
                if (peer == null) {
                    send(socket, WireMessage(type = "error", message = "Device is not paired"))
                    return
                }
                val incoming = requireNotNull(message.batch)
                engine.apply(incoming.changes)
                val local = limitedBatch(message.cursor ?: SyncCursor.START)
                savePeer(peer.copy(lastSyncAt = now()))
                send(socket, WireMessage(type = "sync", batch = local))
            }
            else -> send(socket, WireMessage(type = "error", message = "Unsupported request"))
        }
    }

    private fun limitedBatch(cursor: SyncCursor): SyncBatch =
        SyncPager.limit(engine.localChanges(cursor, 500), MAX_SYNC_PAYLOAD)

    private fun connect(host: String, port: Int, pinnedFingerprint: String): SSLSocket {
        val context = clientContext(identity, pinnedFingerprint)
        return (context.socketFactory.createSocket(host, port) as SSLSocket).apply {
            soTimeout = 15_000
        }
    }

    private fun connectFromEndpoint(endpoint: String, pinnedFingerprint: String): SSLSocket {
        val host = endpoint.substringBeforeLast(':')
        val port = endpoint.substringAfterLast(':').toIntOrNull() ?: DEFAULT_PORT
        return connect(host, port, pinnedFingerprint)
    }

    private fun send(socket: SSLSocket, message: WireMessage) {
        val bytes = json.encodeToString(WireMessage.serializer(), message).encodeToByteArray()
        require(bytes.size <= MAX_FRAME) { "Sync message is too large" }
        val output = DataOutputStream(socket.outputStream)
        output.writeInt(bytes.size)
        output.write(bytes)
        output.flush()
    }

    private fun receive(socket: SSLSocket): WireMessage {
        val input = DataInputStream(socket.inputStream)
        val size = input.readInt()
        require(size in 1..MAX_FRAME) { "Invalid sync message size" }
        val bytes = ByteArray(size).also(input::readFully)
        return json.decodeFromString(WireMessage.serializer(), bytes.decodeToString())
    }

    private fun loadOrCreateIdentity(): Identity {
        secrets.get(IDENTITY_KEY)?.let { bytes ->
            runCatching {
                val keyStore = KeyStore.getInstance("PKCS12")
                keyStore.load(ByteArrayInputStream(bytes), IDENTITY_PASSWORD)
                val certificate = keyStore.getCertificate(ALIAS) as X509Certificate
                return identityFrom(keyStore, certificate)
            }
        }
        val generator = KeyPairGenerator.getInstance("EC").apply { initialize(256) }
        val pair = generator.generateKeyPair()
        val now = now()
        val subject = X500Name("CN=OmniShop Device")
        val certificate = JcaX509CertificateConverter().getCertificate(
            JcaX509v3CertificateBuilder(
                subject, BigInteger(128, SecureRandom()), java.util.Date(now - 1_000),
                java.util.Date(now + TEN_YEARS_MILLIS), subject, pair.public,
            ).build(JcaContentSignerBuilder("SHA256withECDSA").build(pair.private)),
        )
        val keyStore = KeyStore.getInstance("PKCS12").apply { load(null, null) }
        keyStore.setKeyEntry(ALIAS, pair.private, IDENTITY_PASSWORD, arrayOf(certificate))
        val output = ByteArrayOutputStream()
        keyStore.store(output, IDENTITY_PASSWORD)
        secrets.set(IDENTITY_KEY, output.toByteArray())
        return identityFrom(keyStore, certificate)
    }

    private fun identityFrom(keyStore: KeyStore, certificate: X509Certificate): Identity {
        val publicHash = java.security.MessageDigest.getInstance("SHA-256")
            .digest(certificate.publicKey.encoded)
        val deviceId = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(publicHash.copyOf(16))
        return Identity(keyStore, certificate, deviceId, fingerprint(certificate))
    }

    private fun serverContext(identity: Identity): SSLContext {
        val trustAll = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>, authType: String) = Unit
            override fun checkServerTrusted(chain: Array<out X509Certificate>, authType: String) = Unit
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        }
        return SSLContext.getInstance("TLS").apply {
            init(keyManagers(identity), arrayOf(trustAll), SecureRandom())
        }
    }

    private fun clientContext(identity: Identity, pinnedFingerprint: String): SSLContext {
        val pinning = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>, authType: String) = Unit
            override fun checkServerTrusted(chain: Array<out X509Certificate>, authType: String) {
                if (fingerprint(chain.first()) != pinnedFingerprint) {
                    throw CertificateException("Server certificate pin mismatch")
                }
            }
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        }
        return SSLContext.getInstance("TLS").apply {
            init(keyManagers(identity), arrayOf(pinning), SecureRandom())
        }
    }

    private fun keyManagers(identity: Identity) =
        KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm()).apply {
            init(identity.keyStore, IDENTITY_PASSWORD)
        }.keyManagers

    private fun fingerprint(certificate: X509Certificate): String =
        java.security.MessageDigest.getInstance("SHA-256").digest(certificate.encoded)
            .joinToString("") { "%02x".format(it) }

    private fun sas(secret: String, hostFingerprint: String, clientFingerprint: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.encodeToByteArray(), "HmacSHA256"))
        val digest = mac.doFinal("$hostFingerprint|$clientFingerprint".encodeToByteArray())
        val value = ((digest[0].toLong() and 0xff) shl 24) or
            ((digest[1].toLong() and 0xff) shl 16) or
            ((digest[2].toLong() and 0xff) shl 8) or
            (digest[3].toLong() and 0xff)
        return (value % 1_000_000).toString().padStart(6, '0').chunked(3).joinToString(" ")
    }

    private fun lanHost(): String {
        val interfaces = NetworkInterface.getNetworkInterfaces() ?: return "127.0.0.1"
        Collections.list(interfaces).forEach { network ->
            if (!network.isUp || network.isLoopback) return@forEach
            Collections.list(network.inetAddresses).forEach { address ->
                if (address is Inet4Address && address.isSiteLocalAddress) return address.hostAddress ?: "127.0.0.1"
            }
        }
        return "127.0.0.1"
    }

    private fun loadPeers(): List<StoredPeer> =
        secrets.get(PEERS_KEY)?.decodeToString()?.let {
            runCatching { json.decodeFromString<List<StoredPeer>>(it) }.getOrDefault(emptyList())
        } ?: emptyList()

    private fun savePeer(peer: StoredPeer) {
        savePeers(loadPeers().filterNot { it.deviceId == peer.deviceId } + peer)
    }

    private fun savePeers(peers: List<StoredPeer>) {
        secrets.set(PEERS_KEY, json.encodeToString(peers).encodeToByteArray())
    }

    private data class Identity(
        val keyStore: KeyStore,
        val certificate: X509Certificate,
        val deviceId: String,
        val fingerprint: String,
    )

    @Serializable private data class StoredPeer(
        val deviceId: String,
        val displayName: String,
        val endpoint: String,
        val fingerprint: String,
        val lastSyncAt: Long,
        val sas: String? = null,
    )

    @Serializable private data class PairingPayload(
        val version: Int,
        val deviceId: String,
        val fingerprint: String,
        val host: String,
        val port: Int,
        val secret: String,
        val expiresAt: Long,
    )

    @Serializable private data class WireMessage(
        val type: String,
        val secret: String? = null,
        val deviceId: String? = null,
        val name: String? = null,
        val fingerprint: String? = null,
        val sas: String? = null,
        val batch: SyncBatch? = null,
        val cursor: SyncCursor? = null,
        val message: String? = null,
    )

    private companion object {
        const val VERSION = 1
        const val DEFAULT_PORT = 8787
        const val MAX_FRAME = 32 * 1024 * 1024
        const val MAX_SYNC_PAYLOAD = 24 * 1024 * 1024
        const val MAX_SYNC_PAGES = 10_000
        const val PAIRING_LIFETIME_MILLIS = 5 * 60 * 1000L
        const val TEN_YEARS_MILLIS = 10L * 365 * 24 * 60 * 60 * 1000
        const val ALIAS = "device"
        const val IDENTITY_KEY = "sync.identity.v1"
        const val PEERS_KEY = "sync.peers.v1"
        val IDENTITY_PASSWORD = "omnishop-sync-identity".toCharArray()
        val json = Json {
            encodeDefaults = true
            ignoreUnknownKeys = false
        }
    }
}
