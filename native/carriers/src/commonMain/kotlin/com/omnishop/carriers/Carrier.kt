package com.omnishop.carriers

import com.omnishop.core.ShipmentStatus

data class CarrierCredentials(val apiKey: String) {
    init { require(apiKey.isNotBlank()) }
}

data class CarrierEvent(
    val sourceEventId: String,
    val status: ShipmentStatus,
    val description: String,
    val occurredAtEpochMillis: Long?,
    val originalTimestamp: String?,
    val originalTimezone: String?,
) {
    init { require(sourceEventId.isNotBlank() && description.isNotBlank()) }
}

data class CarrierTracking(
    val carrierId: String,
    val trackingNumber: String,
    val events: List<CarrierEvent>,
    val fetchedAtEpochMillis: Long,
)

enum class CarrierProblem {
    NOT_CONFIGURED, INVALID_TRACKING, UNAUTHORIZED, NOT_FOUND, RATE_LIMITED, UNAVAILABLE, PROTOCOL,
}

data class CarrierFailure(
    val problem: CarrierProblem,
    val message: String,
    val cause: Throwable? = null,
)

sealed interface CarrierResult {
    data class Success(val tracking: CarrierTracking) : CarrierResult
    data class Failure(val failure: CarrierFailure) : CarrierResult
}

interface CarrierAdapter {
    val id: String
    val displayName: String
    fun matches(trackingNumber: String): Boolean
    suspend fun track(trackingNumber: String, credentials: CarrierCredentials): CarrierResult
}
