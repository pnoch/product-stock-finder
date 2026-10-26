package com.omnishop.carriers

import kotlin.test.*

class ThaiPostTimeTest {
    @Test fun convertsBuddhistEraTimestampAndOffsetToUtc() {
        assertEquals(ThaiPostTimestamp(1_563_534_746_000, "+07:00"), parseThaiPostTimestamp("19/07/2562 18:12:26+07:00"))
    }

    @Test fun handlesLeapDaysAndNegativeOffsets() {
        assertNotNull(parseThaiPostTimestamp("29/02/2563 00:00:00+00:00"))
        assertNull(parseThaiPostTimestamp("29/02/2562 00:00:00+00:00"))
        assertNotNull(parseThaiPostTimestamp("01/01/2563 00:00:00-05:30"))
    }

    @Test fun rejectsMissingOffsetImpossibleDatesAndOutOfRangeTime() {
        assertNull(parseThaiPostTimestamp("19/07/2562 18:12:26"))
        assertNull(parseThaiPostTimestamp("31/04/2562 18:12:26+07:00"))
        assertNull(parseThaiPostTimestamp("19/07/2562 24:00:00+07:00"))
        assertNull(parseThaiPostTimestamp("19/07/2562 18:60:00+07:00"))
        assertNull(parseThaiPostTimestamp("19/07/2562 18:12:60+07:00"))
        assertNull(parseThaiPostTimestamp("19/07/1562 18:12:26+07:00"))
        assertNull(parseThaiPostTimestamp("nonsense"))
    }
}
