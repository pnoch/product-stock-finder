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
              {"checkpoint_date":"2026-10-26T06:18:39","checkpoint_delivery_status":"delivered","tracking_detail":"Successful delivery [ CHANTHABURI Post Office ]"},
              {"checkpoint_date":"2026-10-25T05:59:14","checkpoint_delivery_status":"transit","tracking_detail":"Posting/Collection [ BANG YAI Post Office ]"}
            ]}}}""")
        }.track("ed852942182th", CarrierCredentials("key-1"))
        val tracking = assertIs<CarrierResult.Success>(result).tracking
        assertEquals(1, calls)
        assertEquals("thailandpost", tracking.carrierId)
        assertEquals(2, tracking.events.size)
        assertEquals(com.omnishop.core.ShipmentStatus.DELIVERED, tracking.events[0].status)
        assertTrue(tracking.events[0].description.contains("CHANTHABURI"))
        assertEquals(com.omnishop.core.ShipmentStatus.SHIPPED, tracking.events[1].status)
    }

    @Test fun refreshesExistingTrackingWithGet() = runBlocking {
        val calls = mutableListOf<String>()
        val result = adapter { request ->
            calls += request.url.encodedPath
            if (request.url.encodedPath.endsWith("/create")) {
                json("""{"meta":{"code":4101,"message":"Tracking No. already exists."}}""", HttpStatusCode.BadRequest)
            } else {
                assertEquals("thailand-post", request.url.parameters["courier_code"])
                json("""{"meta":{"code":200},"data":[{"origin_info":{"trackinfo":[
                  {"Date":"2026-10-29 08:00:00","StatusDescription":"In Transit"}
                ]}}]}""")
            }
        }.track("ED852942182TH", CarrierCredentials("key"))
        assertEquals(listOf("/v4/trackings/create", "/v4/trackings/get"), calls)
        assertEquals(1, assertIs<CarrierResult.Success>(result).tracking.events.size)
    }

    @Test fun mapsStatusHintsAndRateLimits() = runBlocking {
        val delivered = adapter { json("""{"meta":{"code":200},"data":{"origin_info":{"trackinfo":[
          {"checkpoint_date":"2026-10-26T06:18:39","checkpoint_delivery_status":"delivered","tracking_detail":"At destination"}
        ]}}}""") }.track("JD282523205TH", CarrierCredentials("key"))
        assertEquals(com.omnishop.core.ShipmentStatus.DELIVERED, assertIs<CarrierResult.Success>(delivered).tracking.events.single().status)

        val rateLimited = adapter { json("""{"meta":{"code":429,"message":"Too many requests"}}""", HttpStatusCode.TooManyRequests) }
            .track("JD282523205TH", CarrierCredentials("key"))
        assertEquals(CarrierProblem.RATE_LIMITED, assertIs<CarrierResult.Failure>(rateLimited).failure.problem)
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
