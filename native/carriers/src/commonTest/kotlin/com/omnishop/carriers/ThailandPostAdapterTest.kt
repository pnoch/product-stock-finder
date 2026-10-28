package com.omnishop.carriers

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.client.request.HttpResponseData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.runBlocking
import kotlin.test.*

class ThailandPostAdapterTest {
    private val successItems = """
        {"response":{"items":{"ED852942182TH":[
          {"barcode":"ED852942182TH","status":"103","status_description":"รับฝาก",
           "status_date":"19/07/2562 18:12:26+07:00","location":"คต.กาดสวนแก้ว","postcode":"00131"},
          {"barcode":"ED852942182TH","status":"501","status_description":"นำจ่ายสำเร็จ",
           "status_date":"20/07/2562 10:00:00+07:00","location":"เชียงใหม่","postcode":"50000"}
        ]},"track_count":{"count_number":2,"track_count_limit":1500}},"message":"successful","status":true}
    """.trimIndent()

    private fun adapter(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData) =
        ThailandPostAdapter(HttpClient(MockEngine(handler)) { expectSuccess = false }) { 999L }

    private fun MockRequestHandleScope.json(body: String, status: HttpStatusCode = HttpStatusCode.OK) =
        respond(body, status, headersOf(HttpHeaders.ContentType, "application/json"))

    @Test fun authenticatesUsesTheTokenAndMapsEvents() = runBlocking {
        val calls = mutableListOf<String>()
        val result = adapter { request ->
            calls += request.url.encodedPath
            if (request.url.encodedPath.endsWith("/authenticate/token")) {
                assertEquals("Token api-key", request.headers[HttpHeaders.Authorization])
                json("""{"token":"token-1","status":true}""")
            } else {
                assertEquals("Token token-1", request.headers[HttpHeaders.Authorization])
                json(successItems)
            }
        }.track(" ed852942182th ", CarrierCredentials("api-key"))

        val tracking = assertIs<CarrierResult.Success>(result).tracking
        assertEquals(listOf("/post/api/v1/authenticate/token", "/post/api/v1/track"), calls)
        assertEquals("thailandpost", tracking.carrierId)
        assertEquals("ED852942182TH", tracking.trackingNumber)
        assertEquals(999L, tracking.fetchedAtEpochMillis)
        assertEquals(2, tracking.events.size)
        assertEquals(com.omnishop.core.ShipmentStatus.SHIPPED, tracking.events[0].status)
        assertEquals(1_563_534_746_000L, tracking.events[0].occurredAtEpochMillis)
        assertEquals("+07:00", tracking.events[0].originalTimezone)
        assertTrue(tracking.events[0].description.contains("คต.กาดสวนแก้ว"))
        assertEquals(com.omnishop.core.ShipmentStatus.DELIVERED, tracking.events[1].status)
    }

    @Test fun rejectsInvalidTrackingBeforeAnyNetworkCall() = runBlocking {
        var calls = 0
        val result = adapter { calls++; json("{}") }.track("INVALID", CarrierCredentials("key"))
        assertEquals(CarrierProblem.INVALID_TRACKING, assertIs<CarrierResult.Failure>(result).failure.problem)
        assertEquals(0, calls)
    }

    @Test fun mapsUnauthorizedRateLimitAndMissingEvents() = runBlocking {
        val unauthorized = adapter { json("""{"message":"nope"}""", HttpStatusCode.Unauthorized) }
            .track("ED852942182TH", CarrierCredentials("bad"))
        assertEquals(CarrierProblem.UNAUTHORIZED, assertIs<CarrierResult.Failure>(unauthorized).failure.problem)

        val rateLimited = adapter { request ->
            if (request.url.encodedPath.endsWith("/authenticate/token")) json("""{"token":"t"}""")
            else json("""{"message":"slow down"}""", HttpStatusCode.TooManyRequests)
        }.track("ED852942182TH", CarrierCredentials("key"))
        assertEquals(CarrierProblem.RATE_LIMITED, assertIs<CarrierResult.Failure>(rateLimited).failure.problem)

        val missing = adapter { request ->
            if (request.url.encodedPath.endsWith("/authenticate/token")) json("""{"token":"t"}""")
            else json("""{"response":{"items":{}},"status":true}""")
        }.track("ED852942182TH", CarrierCredentials("key"))
        assertEquals(CarrierProblem.NOT_FOUND, assertIs<CarrierResult.Failure>(missing).failure.problem)
    }

    @Test fun mapsDocumentedFallbackFieldsAndBadRequest() = runBlocking {
        val fallback = adapter { request ->
            if (request.url.encodedPath.endsWith("/authenticate/token")) json("""{"token":"t"}""")
            else json("""{"response":{"items":{"ED852942182TH":[
              {"barcode":"ED852942182TH","status":"501","statusDetail":"Delivered",
               "delivery_datetime":"20/07/2562 10:00:00+07:00","location":"Chiang Mai"}
            ]}},"status":true}""")
        }.track("ED852942182TH", CarrierCredentials("key"))
        val event = assertIs<CarrierResult.Success>(fallback).tracking.events.single()
        assertTrue(event.description.startsWith("Delivered"))
        assertTrue(event.description.contains("Chiang Mai"))
        assertEquals(com.omnishop.core.ShipmentStatus.DELIVERED, event.status)
        assertEquals(1_563_591_600_000L, event.occurredAtEpochMillis)

        val badRequest = adapter { json("""{"message":"bad"}""", HttpStatusCode.BadRequest) }
            .track("ED852942182TH", CarrierCredentials("key"))
        assertEquals(CarrierProblem.PROTOCOL, assertIs<CarrierResult.Failure>(badRequest).failure.problem)
    }

    @Test fun mapsMalformedResponsesAndNetworkFailures() = runBlocking {
        val malformed = adapter { request ->
            if (request.url.encodedPath.endsWith("/authenticate/token")) json("""{"token":"t"}""")
            else json("{not-json")
        }.track("ED852942182TH", CarrierCredentials("key"))
        assertEquals(CarrierProblem.PROTOCOL, assertIs<CarrierResult.Failure>(malformed).failure.problem)

        val noToken = adapter { json("""{"status":true}""") }
            .track("ED852942182TH", CarrierCredentials("key"))
        assertEquals(CarrierProblem.PROTOCOL, assertIs<CarrierResult.Failure>(noToken).failure.problem)

        val network = adapter { throw IllegalStateException("offline") }
            .track("ED852942182TH", CarrierCredentials("key"))
        assertEquals(CarrierProblem.UNAVAILABLE, assertIs<CarrierResult.Failure>(network).failure.problem)
    }

    @Test fun recognisesThailandPostTrackingNumbers() {
        val adapter = adapter { json("{}") }
        assertTrue(adapter.matches("ED852942182TH"))
        assertTrue(adapter.matches(" ed852942182th "))
        assertFalse(adapter.matches("ED852942182"))
        assertFalse(adapter.matches("1234567890123"))
    }
}
