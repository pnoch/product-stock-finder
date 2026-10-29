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
    override val id: String = "thailandpost",
    override val displayName: String = "Thailand Post · TrackingMore",
    private val courierCode: String? = "thailand-post",
    private val trackingPattern: Regex = Regex("^[A-Z]{2}\\d{9}TH$"),
    private val client: HttpClient = defaultClient(),
    private val now: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) : CarrierAdapter {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    override fun matches(trackingNumber: String): Boolean =
        trackingPattern.matches(trackingNumber.trim().uppercase())

    private suspend fun detectCourier(tracking: String, apiKey: String): String? {
        val response = client.post(DETECT_URL) {
            header("Tracking-Api-Key", apiKey.trim())
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(DetectRequest.serializer(), DetectRequest(tracking)))
        }
        if (!response.status.isSuccess()) return null
        val body = runCatching { json.decodeFromString<DetectResponse>(response.bodyAsText()) }.getOrNull()
        return body?.data?.firstOrNull()?.courier_code?.takeIf { it.isNotBlank() }
    }

    suspend fun validateKey(apiKey: String): Boolean {
        if (apiKey.isBlank()) return false
        return runCatching {
            client.get("https://api.trackingmore.com/v4/couriers") {
                header("Tracking-Api-Key", apiKey.trim())
            }.status.isSuccess()
        }.getOrDefault(false)
    }

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
            val code = courierCode ?: detectCourier(tracking, credentials.apiKey)
                ?: return failure(CarrierProblem.NOT_FOUND, "TrackingMore could not detect a carrier")
            val response = client.post(TRACK_URL) {
                header("Tracking-Api-Key", credentials.apiKey.trim())
                contentType(ContentType.Application.Json)
                setBody(json.encodeToString(CreateRequest.serializer(), CreateRequest(tracking, code)))
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
                return metaFailure(body.meta)
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
        when (response.status.value) {
            401, 403 -> return failure(CarrierProblem.UNAUTHORIZED, "TrackingMore rejected the API key")
            429 -> return failure(CarrierProblem.RATE_LIMITED, "TrackingMore is rate limiting requests")
        }
        if (!response.status.isSuccess()) {
            return failure(CarrierProblem.UNAVAILABLE, "TrackingMore lookup failed (${response.status.value})")
        }
        val body = runCatching { json.decodeFromString<GetResponse>(response.bodyAsText()) }.getOrElse {
            return failure(CarrierProblem.PROTOCOL, "TrackingMore returned an unreadable response", it)
        }
        if (body.meta?.code != 200) return metaFailure(body.meta)
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
        val description = (item.tracking_detail ?: item.StatusDescription ?: item.Details ?: item.Status)
            ?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val location = item.location?.trim()?.takeIf { it.isNotEmpty() }
        val timestamp = (item.checkpoint_date ?: item.Date)?.trim()?.takeIf { it.isNotEmpty() }
        val eventKey = listOf(
            item.Status.orEmpty(), item.checkpoint_delivery_status.orEmpty(), description,
            timestamp.orEmpty(), location.orEmpty(),
        ).joinToString("|")
        return CarrierEvent(
            sourceEventId = eventKey,
            status = normalizeStatus(description, item.checkpoint_delivery_status),
            description = if (location != null) "$description — $location" else description,
            occurredAtEpochMillis = null,
            originalTimestamp = timestamp,
            originalTimezone = null,
        )
    }

    private fun normalizeStatus(description: String, hint: String?): ShipmentStatus {
        val text = description.lowercase()
        val fromDescription = when {
            text.contains("นำจ่ายไม่สำเร็จ") || text.contains("delivery attempt") ||
                text.contains("attempted") || text.contains("พยายามนำจ่าย") -> ShipmentStatus.DELIVERY_ATTEMPTED
            text.contains("นำจ่ายสำเร็จ") || text.contains("delivered") ||
                text.contains("successful delivery") || text.contains("ผู้รับรับสินค้า") -> ShipmentStatus.DELIVERED
            text.contains("ออกนำจ่าย") || text.contains("out for delivery") -> ShipmentStatus.OUT_FOR_DELIVERY
            text.contains("ศุลกากร") || text.contains("customs") -> ShipmentStatus.CUSTOMS_CLEARANCE
            text.contains("ตีกลับ") || text.contains("ส่งคืน") || text.contains("return to sender") ->
                ShipmentStatus.RETURNING_TO_SENDER
            text.contains("สูญหาย") || text.contains("lost") -> ShipmentStatus.LOST
            text.contains("ยกเลิก") || text.contains("cancel") -> ShipmentStatus.CANCELLED
            text.contains("ถึงศูนย์") || text.contains("arrived at") -> ShipmentStatus.ARRIVED_AT_LOCAL_FACILITY
            text.contains("รับฝาก") || text.contains("ฝากส่ง") || text.contains("accepted") ||
                text.contains("posting/collection") || text.contains("posting") -> ShipmentStatus.SHIPPED
            text.contains("ขนส่ง") || text.contains("คัดแยก") || text.contains("in transit") ||
                text.contains("departure") || text.contains("arrival") -> ShipmentStatus.IN_TRANSIT
            else -> ShipmentStatus.UNKNOWN
        }
        if (fromDescription != ShipmentStatus.UNKNOWN) return fromDescription
        val normalizedHint = hint.orEmpty().lowercase()
        return when {
            normalizedHint.contains("delivered") -> ShipmentStatus.DELIVERED
            normalizedHint.contains("outfordelivery") -> ShipmentStatus.OUT_FOR_DELIVERY
            normalizedHint.contains("pickup") -> ShipmentStatus.SHIPPED
            normalizedHint.contains("transit") -> ShipmentStatus.IN_TRANSIT
            normalizedHint.contains("exception") || normalizedHint.contains("expired") -> ShipmentStatus.EXCEPTION
            else -> ShipmentStatus.UNKNOWN
        }
    }

    private fun metaFailure(meta: Meta?): CarrierResult {
        val message = meta?.message ?: "TrackingMore rejected the tracking request"
        val credits = message.contains("credit", ignoreCase = true) || message.contains("quota", ignoreCase = true)
        return when {
            meta?.code == 401 || meta?.code == 403 -> failure(CarrierProblem.UNAUTHORIZED, message)
            meta?.code == 429 || credits -> failure(CarrierProblem.RATE_LIMITED, message)
            else -> failure(CarrierProblem.PROTOCOL, message)
        }
    }

    private fun failure(problem: CarrierProblem, message: String, cause: Throwable? = null) =
        CarrierResult.Failure(CarrierFailure(problem, message, cause))

    private companion object {
        const val TRACK_URL = "https://api.trackingmore.com/v4/trackings/create"
        const val GET_URL = "https://api.trackingmore.com/v4/trackings/get"
        const val DETECT_URL = "https://api.trackingmore.com/v4/couriers/detect"
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

object TrackingMoreCarriers {
    private val GENERIC = Regex("^[A-Za-z0-9-]{4,40}$")

    val all: List<TrackingMoreAdapter> = listOf(
        TrackingMoreAdapter(),
        TrackingMoreAdapter("flash", "Flash Express · TrackingMore", null, GENERIC),
        TrackingMoreAdapter("jnt", "J&T Express · TrackingMore", null, GENERIC),
        TrackingMoreAdapter("ninjavan", "Ninja Van · TrackingMore", null, GENERIC),
        TrackingMoreAdapter("kex", "KEX / Kerry Express · TrackingMore", null, GENERIC),
        TrackingMoreAdapter("spx", "SPX Express · TrackingMore", null, GENERIC),
        TrackingMoreAdapter("lex", "LEX (Lazada) · TrackingMore", null, GENERIC),
    )
}

@Serializable
private data class CreateRequest(
    val tracking_number: String,
    val courier_code: String,
)

@Serializable
private data class DetectRequest(val tracking_number: String)

@Serializable
private data class DetectResponse(val data: List<DetectedCourier> = emptyList())

@Serializable
private data class DetectedCourier(val courier_code: String? = null)

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
    val Status: String? = null,
    val checkpoint_date: String? = null,
    val checkpoint_delivery_status: String? = null,
    val tracking_detail: String? = null,
    @kotlinx.serialization.SerialName("location") val location: String? = null,
)
