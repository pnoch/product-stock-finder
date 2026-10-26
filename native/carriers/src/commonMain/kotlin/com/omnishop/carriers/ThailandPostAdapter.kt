package com.omnishop.carriers

import com.omnishop.core.ShipmentStatus
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.coroutines.cancellation.CancellationException
import kotlin.time.Clock

class ThailandPostAdapter(
    private val client: HttpClient = defaultClient(),
    private val now: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) : CarrierAdapter {
    override val id: String = "thailandpost"
    override val displayName: String = "Thailand Post"

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    override fun matches(trackingNumber: String): Boolean =
        TRACKING_NUMBER.matches(trackingNumber.trim().uppercase())

    override suspend fun track(
        trackingNumber: String,
        credentials: CarrierCredentials,
    ): CarrierResult {
        val tracking = trackingNumber.trim().uppercase()
        if (!matches(tracking)) {
            return failure(CarrierProblem.INVALID_TRACKING, "Enter a Thailand Post tracking number (for example ED852942182TH)")
        }
        if (credentials.apiKey.isBlank()) {
            return failure(CarrierProblem.NOT_CONFIGURED, "Add a Thailand Post API key in Profile")
        }
        return try {
            val auth = client.post(AUTH_URL) {
                header(HttpHeaders.Authorization, "Token ${credentials.apiKey}")
                contentType(ContentType.Application.Json)
                setBody("{}")
            }
            when (auth.status.value) {
                401, 403 -> return failure(CarrierProblem.UNAUTHORIZED, "Thailand Post rejected the API key")
                429 -> return failure(CarrierProblem.RATE_LIMITED, "Thailand Post is rate limiting requests")
            }
            if (!auth.status.isSuccess()) {
                return failure(CarrierProblem.UNAVAILABLE, "Thailand Post authentication failed (${auth.status.value})")
            }
            val token = runCatching { json.decodeFromString<AuthResponse>(auth.bodyAsText()).token }
                .getOrNull()?.takeIf { it.isNotBlank() }
                ?: return failure(CarrierProblem.PROTOCOL, "Thailand Post did not return an access token")

            val response = client.post(TRACK_URL) {
                header(HttpHeaders.Authorization, "Token $token")
                contentType(ContentType.Application.Json)
                setBody(json.encodeToString(TrackRequest.serializer(), TrackRequest(barcode = listOf(tracking))))
            }
            when (response.status.value) {
                401, 403 -> return failure(CarrierProblem.UNAUTHORIZED, "Thailand Post rejected the tracking session")
                404 -> return failure(CarrierProblem.NOT_FOUND, "Thailand Post has no record for this tracking number")
                429 -> return failure(CarrierProblem.RATE_LIMITED, "Thailand Post is rate limiting requests")
            }
            if (!response.status.isSuccess()) {
                return failure(CarrierProblem.UNAVAILABLE, "Thailand Post tracking failed (${response.status.value})")
            }
            val body = runCatching { json.decodeFromString<TrackResponse>(response.bodyAsText()) }.getOrElse {
                return failure(CarrierProblem.PROTOCOL, "Thailand Post returned an unreadable response", it)
            }
            if (body.status == false) {
                return failure(CarrierProblem.PROTOCOL, body.message ?: "Thailand Post rejected the tracking request")
            }
            val items = body.response?.items?.get(tracking)
                ?: body.response?.items?.values?.firstOrNull()
                ?: emptyList()
            if (items.isEmpty()) {
                return failure(CarrierProblem.NOT_FOUND, "No tracking events are available yet")
            }
            val events = items.mapNotNull { it.toEvent() }
            if (events.isEmpty()) {
                return failure(CarrierProblem.NOT_FOUND, "No usable tracking events are available yet")
            }
            CarrierResult.Success(CarrierTracking(id, tracking, events, now()))
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: Exception) {
            CarrierResult.Failure(
                CarrierFailure(CarrierProblem.UNAVAILABLE, "Could not reach Thailand Post", failure),
            )
        }
    }

    private fun ThaiPostItem.toEvent(): CarrierEvent? {
        val rawTimestamp = status_date?.trim()?.takeIf { it.isNotEmpty() }
        val rawDescription = status_description?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val location = location?.trim()?.takeIf { it.isNotEmpty() }
        val parsed = rawTimestamp?.let(::parseThaiPostTimestamp)
        val eventKey = listOf(
            status.orEmpty(), rawDescription, rawTimestamp.orEmpty(),
            location.orEmpty(), postcode.orEmpty(), delivery_status.orEmpty(),
        ).joinToString("|")
        return CarrierEvent(
            sourceEventId = eventKey,
            status = normalizeStatus(rawDescription),
            description = if (location != null) "$rawDescription — $location" else rawDescription,
            occurredAtEpochMillis = parsed?.epochMillis,
            originalTimestamp = rawTimestamp,
            originalTimezone = parsed?.offset,
        )
    }

    private fun normalizeStatus(description: String): ShipmentStatus {
        val text = description.lowercase()
        return when {
            text.contains("นำจ่ายไม่สำเร็จ") || text.contains("delivery attempt") ||
                text.contains("attempted") || text.contains("พยายามนำจ่าย") -> ShipmentStatus.DELIVERY_ATTEMPTED
            text.contains("นำจ่ายสำเร็จ") || text.contains("delivered") ||
                text.contains("ผู้รับรับสินค้า") -> ShipmentStatus.DELIVERED
            text.contains("ออกนำจ่าย") || text.contains("out for delivery") -> ShipmentStatus.OUT_FOR_DELIVERY
            text.contains("ศุลกากร") || text.contains("customs") -> ShipmentStatus.CUSTOMS_CLEARANCE
            text.contains("ตีกลับ") || text.contains("ส่งคืน") || text.contains("return to sender") ->
                ShipmentStatus.RETURNING_TO_SENDER
            text.contains("สูญหาย") || text.contains("lost") -> ShipmentStatus.LOST
            text.contains("ยกเลิก") || text.contains("cancel") -> ShipmentStatus.CANCELLED
            text.contains("ถึงศูนย์") || text.contains("arrived at") -> ShipmentStatus.ARRIVED_AT_LOCAL_FACILITY
            text.contains("รับฝาก") || text.contains("ฝากส่ง") || text.contains("accepted") ->
                ShipmentStatus.SHIPPED
            text.contains("ขนส่ง") || text.contains("คัดแยก") || text.contains("in transit") ->
                ShipmentStatus.IN_TRANSIT
            else -> ShipmentStatus.UNKNOWN
        }
    }

    private fun failure(problem: CarrierProblem, message: String, cause: Throwable? = null) =
        CarrierResult.Failure(CarrierFailure(problem, message, cause))

    private companion object {
        const val AUTH_URL = "https://trackapi.thailandpost.co.th/post/api/v1/authenticate/token"
        const val TRACK_URL = "https://trackapi.thailandpost.co.th/post/api/v1/track"
        val TRACKING_NUMBER = Regex("^[A-Z]{2}\\d{9}TH$")

        fun defaultClient(): HttpClient = HttpClient {
            expectSuccess = false
            install(HttpTimeout) {
                requestTimeoutMillis = 15_000
                connectTimeoutMillis = 10_000
            }
        }
    }
}

@Serializable
private data class AuthResponse(
    val token: String? = null,
    val message: String? = null,
    val status: Boolean? = null,
)

@Serializable
private data class TrackRequest(
    val status: String = "all",
    val language: String = "TH",
    val barcode: List<String>,
)

@Serializable
private data class TrackResponse(
    val response: TrackBody? = null,
    val message: String? = null,
    val status: Boolean? = null,
)

@Serializable
private data class TrackBody(
    val items: Map<String, List<ThaiPostItem>> = emptyMap(),
)

@Serializable
private data class ThaiPostItem(
    val barcode: String? = null,
    val status: String? = null,
    val status_description: String? = null,
    val status_date: String? = null,
    val location: String? = null,
    val postcode: String? = null,
    val delivery_status: String? = null,
    val delivery_description: String? = null,
)
