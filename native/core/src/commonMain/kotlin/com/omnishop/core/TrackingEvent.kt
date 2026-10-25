package com.omnishop.core

enum class ObservationMethod { MANUAL, PROVIDER }

data class TrackingEvent(
    val shipmentId: String,
    val source: String,
    val sourceEventId: String,
    val status: ShipmentStatus,
    val description: String,
    val method: ObservationMethod,
    val importedAtEpochMillis: Long,
    val occurredAtEpochMillis: Long? = null,
    val originalTimestamp: String? = null,
    val originalTimezone: String? = null,
) {
    init {
        require(shipmentId.isNotBlank() && source.isNotBlank() && sourceEventId.isNotBlank())
        require(description.isNotBlank())
    }
}

fun mergeTrackingEvents(existing: List<TrackingEvent>, incoming: List<TrackingEvent>): List<TrackingEvent> =
    (existing + incoming).distinctBy { Triple(it.shipmentId, it.source, it.sourceEventId) }
