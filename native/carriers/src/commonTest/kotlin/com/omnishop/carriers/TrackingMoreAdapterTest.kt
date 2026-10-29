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

class TrackingMoreAdapterTest {
    private fun adapter(handler: suspend MockRequestHandleScope.(HttpRequestData) -> HttpResponseData) =
        TrackingMoreAdapter(HttpClient(MockEngine(handler)) { expectSuccess = false }) { 999L }

    private fun MockRequestHandleScope.json(body: String, status: HttpStatusCode = HttpStatusCode.OK) =
        respond(body, status, headersOf(HttpHeaders.ContentType, "application/json"))

    @Test fun createsThailandPostTrackingAndMapsEvents() = runBlocking {
        var calls = 0
        val result = adapter { request ->
            calls++
            assertEquals("/v4/trackings/create", request.url.encodedPath)
            assertEquals("key-1", request.headers["Tracking-Api-Key"])
            json("""{"meta":{"code":200,"message":"ok"},"data":{"origin_info":{"trackinfo":[
              {"Date":"2026-10-29 08:00:00","StatusDescription":"Delivered","Location":"Chiang Mai"},
              {"Date":"2026-10-28 08:00:00","StatusDescription":"In Transit","Details":"Departed hub"}
            ]}}}""")
        }.track("ed852942182th", CarrierCredentials("key-1"))
        val tracking = assertIs<CarrierResult.Success>(result).tracking
        assertEquals(1, calls)
        assertEquals("thailandpost", tracking.carrierId)
        assertEquals(2, tracking.events.size)
        assertEquals(com.omnishop.core.ShipmentStatus.DELIVERED, tracking.events[0].status)
        assertTrue(tracking.events[0].description.contains("Chiang Mai"))
    }

    @Test fun mapsPendingUnauthorizedAndBadRequest() = runBlocking {
        val pending = adapter { json("""{"meta":{"code":200},"data":{"origin_info":{"trackinfo":[]}}}""") }
            .track("ED852942182TH", CarrierCredentials("key"))
        assertEquals(CarrierProblem.NOT_FOUND, assertIs<CarrierResult.Failure>(pending).failure.problem)

        val unauthorized = adapter { json("{}", HttpStatusCode.Unauthorized) }
            .track("ED852942182TH", CarrierCredentials("bad"))
        assertEquals(CarrierProblem.UNAUTHORIZED, assertIs<CarrierResult.Failure>(unauthorized).failure.problem)

        val bad = adapter { json("{}", HttpStatusCode.BadRequest) }
            .track("ED852942182TH", CarrierCredentials("key"))
        assertEquals(CarrierProblem.PROTOCOL, assertIs<CarrierResult.Failure>(bad).failure.problem)
    }

    @Test fun requiresApiKeyAndValidTracking() = runBlocking {
        val invalid = adapter { json("{}") }.track("NOPE", CarrierCredentials("key"))
        assertEquals(CarrierProblem.INVALID_TRACKING, assertIs<CarrierResult.Failure>(invalid).failure.problem)
    }
}
