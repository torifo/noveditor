package dev.noveditor.core.model

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

class SerializationTest {

    private val json = Json

    @Test
    fun manuscript_round_trips_through_json() {
        val original = Manuscript(
            id = ManuscriptId("01HMS-abc"),
            title = "吾輩は猫である",
            body = "名前はまだ無い。😺",
            createdAt = 1_700_000_000_000L,
            updatedAt = 1_700_000_123_456L,
        )

        val encoded = json.encodeToString(original)
        val decoded = json.decodeFromString<Manuscript>(encoded)

        assertEquals(original, decoded)
    }

    @Test
    fun manuscript_summary_round_trips_through_json() {
        val original = ManuscriptSummary(
            id = ManuscriptId("01HMS-xyz"),
            title = "草枕",
            updatedAt = 1_700_000_999_999L,
        )

        val encoded = json.encodeToString(original)
        val decoded = json.decodeFromString<ManuscriptSummary>(encoded)

        assertEquals(original, decoded)
    }

    @Test
    fun manuscript_id_serializes_as_its_underlying_string() {
        // value class is inlined: encodes as the raw string, not a wrapper object.
        val encoded = json.encodeToString(ManuscriptId("id-42"))
        assertEquals("\"id-42\"", encoded)
    }
}
