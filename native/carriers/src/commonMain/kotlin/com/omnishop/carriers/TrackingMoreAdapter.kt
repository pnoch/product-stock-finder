package com.omnishop.carriers

import com.omnishop.core.ShipmentStatus
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
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

class TrackingMoreAdapter(
    private val client: HttpClient = defaultClient(),
    private val now: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) : CarrierAdapter {
    override val id: String = CarrierSettingsIds.THAILAND_POST
    override val displayName: String = "Thailand Post · TrackingMore"

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
            return failure(CarrierProblem.NOT_CONFIGURED, "Add a TrackingMore API key in Profile")
        }
        return try {
            val response = client.post(TRACK_URL) {
                header("Tracking-Api-Key", credentials.apiKey.trim())
                contentType(ContentType.Application.Json)
                setBody(json.encodeToString(CreateRequest.serializer(), CreateRequest(tracking)))
            }
            val text = response.bodyAsText()
            val body = runCatching { json.decodeFromString<CreateResponse>(text) }.getOrNull()
            if (body?.meta?.code == ALREADY_EXISTS) {
                return existing(tracking, credentials.apiKey)
            }
            when (response.status.value) {
                400 -> return failure(CarrierProblem.PROTOCOL, "TrackingMore rejected the request")
                401, 403 -> return failure(CarrierProblem.UNAUTHORIZED, "TrackingMore rejected the API key")
                404 -> return failure(CarrierProblem.NOT_FOUND, "TrackingMore has no record for this tracking number")
                429 -> return failure(CarrierProblem.RATE_LIMITED, "TrackingMore is rate limiting requests")
            }
            if (!response.status.isSuccess()) {
                return failure(CarrierProblem.UNAVAILABLE, "TrackingMore tracking failed (${response.status.value})")
            }
            if (body == null) {
                return failure(CarrierProblem.PROTOCOL, "TrackingMore returned an unreadable response")
            }
            if (body.meta?.code != 200) {
                return failure(CarrierProblem.PROTOCOL, body.meta?.message ?: "TrackingMore rejected the tracking request")
            }
            val data = body.data ?: return failure(CarrierProblem.NOT_FOUND, "TrackingMore returned no tracking data")
            val items = buildList {
                data.origin_info?.trackinfo?.let(::addAll)
                data.destination_info?.trackinfo?.let(::addAll)
            }
            if (items.isEmpty()) {
                return failure(CarrierProblem.NOT_FOUND, "No tracking events are available yet")
            }
            val events = items.mapNotNull(::toEvent)
            if (events.isEmpty()) {
                return failure(CarrierProblem.NOT_FOUND, "No usable tracking events are available yet")
            }
            CarrierResult.Success(CarrierTracking(id, tracking, events, now()))
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: Exception) {
            CarrierResult.Failure(
                CarrierFailure(CarrierProblem.UNAVAILABLE, "Could not reach TrackingMore", failure),
            )
        }
    }

    private suspend fun existing(tracking: String, apiKey: String): CarrierResult {
        val response = client.get(GET_URL) {
            header("Tracking-Api-Key", apiKey.trim())
            parameter("tracking_numbers", tracking)
            parameter("courier_code", "thailand-post")
        }
        if (!response.status.isSuccess()) {
            return failure(CarrierProblem.UNAVAILABLE, "TrackingMore lookup failed (${response.status.value})")
        }
        val body = runCatching { json.decodeFromString<GetResponse>(response.bodyAsText()) }.getOrElse {
            return failure(CarrierProblem.PROTOCOL, "TrackingMore returned an unreadable response", it)
        }
        val data = body.data.firstOrNull()
            ?: return failure(CarrierProblem.NOT_FOUND, "TrackingMore returned no tracking data")
        val items = buildList {
            data.origin_info?.trackinfo?.let(::addAll)
            data.destination_info?.trackinfo?.let(::addAll)
        }
        if (items.isEmpty()) return failure(CarrierProblem.NOT_FOUND, "No tracking events are available yet")
        val events = items.mapNotNull(::toEvent)
        if (events.isEmpty()) return failure(CarrierProblem.NOT_FOUND, "No usable tracking events are available yet")
        return CarrierResult.Success(CarrierTracking(id, tracking, events, now()))
    }

    private fun toEvent(item: TrackInfo): CarrierEvent? {
        val description = (item.StatusDescription ?: item.Details ?: item.Status)
            ?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val location = item.Location?.trim()?.takeIf { it.isNotEmpty() }
        val timestamp = item.Date?.trim()?.takeIf { it.isNotEmpty() }
        val eventKey = listOf(
            item.Status.orEmpty(), description, timestamp.orEmpty(), location.orEmpty(),
        ).joinToString("|")
        return CarrierEvent(
            sourceEventId = eventKey,
            status = normalizeStatus(description),
            description = if (location != null) "$description — $location" else description,
            occurredAtEpochMillis = null,
            originalTimestamp = timestamp,
            originalTimezone = null,
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
        const val TRACK_URL = "https://api.trackingmore.com/v4/trackings/create"
        const val GET_URL = "https://api.trackingmore.com/v4/trackings/get"
        const val ALREADY_EXISTS = 4101
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

private object CarrierSettingsIds {
    const val THAILAND_POST = "thailandpost"
}

@Serializable
private data class CreateRequest(
    val tracking_number: String,
    val courier_code: String = "thailand-post",
)

@Serializable
private data class CreateResponse(
    val meta: Meta? = null,
    val data: TrackingData? = null,
)

@Serializable
private data class Meta(
    val code: Int? = null,
    val message: String? = null,
)

@Serializable
private data class GetResponse(
    val meta: Meta? = null,
    val data: List<TrackingData> = emptyList(),
)

@Serializable
private data class TrackingData(
    val delivery_status: String? = null,
    val origin_info: TrackingInfo? = null,
    val destination_info: TrackingInfo? = null,
)

@Serializable
private data class TrackingInfo(
    val trackinfo: List<TrackInfo> = emptyList(),
)

@Serializable
private data class TrackInfo(
    val Date: String? = null,
    val StatusDescription: String? = null,
    val Details: String? = null,
    val Location: String? = null,
    val Status: String? = null,
)
