package com.omnishop.sync

import kotlin.test.*

class MdnsDiscoveryTest {
    @Test fun parsesPublicPairingRecord() {
        val peer = MdnsDiscovery.parsePeer(
            mapOf("id" to "device", "fp" to "fingerprint", "name" to "Desktop", "expires" to "200"),
            "192.168.1.20",
            8787,
            100,
        )
        assertNotNull(peer)
        assertEquals("device", peer.deviceId)
        assertEquals("Desktop", peer.displayName)
        assertEquals("192.168.1.20:8787", peer.endpoint)
        assertEquals("fingerprint", peer.fingerprint)
        assertEquals(200, peer.pairingExpiresAtEpochMillis)
    }

    @Test fun rejectsExpiredAndIncompleteRecords() {
        val base = mapOf("id" to "device", "fp" to "fingerprint", "expires" to "200")
        assertNull(MdnsDiscovery.parsePeer(base, "192.168.1.20", 8787, 200))
        assertNull(MdnsDiscovery.parsePeer(base - "fp", "192.168.1.20", 8787, 100))
        assertNull(MdnsDiscovery.parsePeer(base, "", 8787, 100))
        assertNull(MdnsDiscovery.parsePeer(base, "192.168.1.20", 0, 100))
    }
}
