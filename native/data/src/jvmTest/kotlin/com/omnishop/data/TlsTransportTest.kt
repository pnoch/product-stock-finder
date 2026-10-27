package com.omnishop.data

import org.bouncycastle.asn1.x500.X500Name
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder
import java.io.DataInputStream
import java.io.DataOutputStream
import java.math.BigInteger
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.Date
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLServerSocket
import javax.net.ssl.SSLSocket
import javax.net.ssl.X509TrustManager
import kotlin.concurrent.thread
import kotlin.test.*

class TlsTransportTest {
    private fun identity(name: String): Pair<KeyStore, X509Certificate> {
        val generator = KeyPairGenerator.getInstance("EC").apply { initialize(256) }
        val pair = generator.generateKeyPair()
        val now = System.currentTimeMillis()
        val subject = X500Name("CN=$name")
        val certificate = JcaX509CertificateConverter().getCertificate(
            JcaX509v3CertificateBuilder(
                subject, BigInteger.valueOf(now), Date(now - 1_000), Date(now + 3_600_000),
                subject, pair.public,
            ).build(JcaContentSignerBuilder("SHA256withECDSA").build(pair.private)),
        )
        val store = KeyStore.getInstance("PKCS12").apply { load(null, null) }
        store.setKeyEntry("key", pair.private, PASSWORD, arrayOf(certificate))
        return store to certificate
    }

    private fun context(identity: KeyStore, pinned: X509Certificate): SSLContext {
        val keyManagers = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm()).apply {
            init(identity, PASSWORD)
        }.keyManagers
        val trust = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>, authType: String) =
                check(chain.first())
            override fun checkServerTrusted(chain: Array<out X509Certificate>, authType: String) =
                check(chain.first())
            private fun check(certificate: X509Certificate) {
                if (!certificate.encoded.contentEquals(pinned.encoded)) {
                    throw java.security.cert.CertificateException("Certificate pin mismatch")
                }
            }
            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        }
        return SSLContext.getInstance("TLS").apply {
            init(keyManagers, arrayOf(trust), SecureRandom())
        }
    }

    @Test fun mutuallyAuthenticatedPinnedTlsExchange() {
        val (serverIdentity, serverCertificate) = identity("server")
        val (clientIdentity, clientCertificate) = identity("client")
        val server = context(serverIdentity, clientCertificate).serverSocketFactory
            .createServerSocket(0) as SSLServerSocket
        server.needClientAuth = true
        server.soTimeout = 10_000
        val serverThread = thread {
            server.accept().use { socket ->
                val input = DataInputStream(socket.inputStream)
                val output = DataOutputStream(socket.outputStream)
                val payload = ByteArray(input.readInt()).also(input::readFully)
                output.writeInt(payload.size)
                output.write(payload)
                output.flush()
            }
        }
        val client = context(clientIdentity, serverCertificate).socketFactory
            .createSocket("127.0.0.1", server.localPort) as SSLSocket
        client.use {
            it.startHandshake()
            val payload = "sync-batch".encodeToByteArray()
            DataOutputStream(it.outputStream).apply { writeInt(payload.size); write(payload); flush() }
            val input = DataInputStream(it.inputStream)
            val echoed = ByteArray(input.readInt()).also(input::readFully)
            assertContentEquals(payload, echoed)
        }
        serverThread.join(10_000)
        server.close()
    }

    @Test fun wrongPinRejectsTheHandshake() {
        val (serverIdentity, _) = identity("server")
        val (clientIdentity, clientCertificate) = identity("client")
        val (_, wrongCertificate) = identity("wrong")
        val server = context(serverIdentity, clientCertificate).serverSocketFactory
            .createServerSocket(0) as SSLServerSocket
        server.needClientAuth = true
        server.soTimeout = 5_000
        val serverThread = thread {
            runCatching { server.accept()?.close() }
        }
        val client = context(clientIdentity, wrongCertificate).socketFactory
            .createSocket("127.0.0.1", server.localPort) as SSLSocket
        client.use {
            assertFails { it.startHandshake() }
        }
        serverThread.join(5_000)
        server.close()
    }

    private companion object {
        val PASSWORD = "test-password".toCharArray()
    }
}
