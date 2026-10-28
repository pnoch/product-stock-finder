package com.omnishop.sync

import com.omnishop.data.SyncJson
import java.io.ByteArrayInputStream
import java.security.MessageDigest
import java.security.cert.CertificateFactory
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals

class SyncProtocolFixtureTest {
    private val fixture = Json.parseToJsonElement(
        requireNotNull(javaClass.getResource("/protocol.json")).readText(),
    ).jsonObject

    @Test fun certificateIdentityMatchesSwiftFixture() {
        val der = Base64.getDecoder().decode(fixture["certificateDER"]!!.jsonPrimitive.content)
        val certificate = CertificateFactory.getInstance("X.509")
            .generateCertificate(ByteArrayInputStream(der)) as java.security.cert.X509Certificate
        val spki = certificate.publicKey.encoded
        val deviceId = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(MessageDigest.getInstance("SHA-256").digest(spki).copyOf(16))
        val fingerprint = MessageDigest.getInstance("SHA-256").digest(der)
            .joinToString("") { "%02x".format(it) }
        assertEquals(fixture["deviceId"]!!.jsonPrimitive.content, deviceId)
        assertEquals(fixture["fingerprint"]!!.jsonPrimitive.content, fingerprint)
    }

    @Test fun sasMatchesSwiftFixture() {
        val sas = fixture["sas"]!!.jsonObject
        val expected = sas["expected"]!!.jsonPrimitive.content
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(sas["secret"]!!.jsonPrimitive.content.encodeToByteArray(), "HmacSHA256"))
        val digest = mac.doFinal(
            "${sas["hostFingerprint"]!!.jsonPrimitive.content}|${sas["clientFingerprint"]!!.jsonPrimitive.content}"
                .encodeToByteArray(),
        )
        val value = ((digest[0].toLong() and 0xff) shl 24) or
            ((digest[1].toLong() and 0xff) shl 16) or
            ((digest[2].toLong() and 0xff) shl 8) or
            (digest[3].toLong() and 0xff)
        val number = (value % 1_000_000).toString().padStart(6, '0')
        assertEquals(expected, "${number.take(3)} ${number.drop(3)}")
    }

    @Test fun pairingAndWirePayloadsRoundTrip() {
        val pairing = fixture["pairingPayload"]!!.jsonObject
        assertEquals(1, pairing["version"]!!.jsonPrimitive.content.toInt())
        assertEquals("192.168.1.20", pairing["host"]!!.jsonPrimitive.content)
        assertEquals(8787, pairing["port"]!!.jsonPrimitive.content.toInt())
        val batch = SyncJson.decodeBatch(fixture["wireBatch"].toString())
        assertEquals(1, batch.changes.size)
        assertEquals("watchlist", batch.changes.single().collection)
        assertEquals("device-a", batch.cursor.originDevice)
        assertEquals(batch, SyncJson.decodeBatch(SyncJson.encodeBatch(batch)))
    }
}
