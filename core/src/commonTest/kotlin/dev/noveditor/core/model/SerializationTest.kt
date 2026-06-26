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

    @Test
    fun novel_round_trips_through_json_including_episode_order() {
        val original = Novel(
            id = NovelId("01NVL-abc"),
            title = "連載小説",
            synopsis = "あらすじ。😺",
            episodeOrder = listOf(EpisodeId("ep-1"), EpisodeId("ep-2"), EpisodeId("ep-3")),
            createdAt = 1_700_000_000_000L,
            updatedAt = 1_700_000_123_456L,
        )

        val encoded = json.encodeToString(original)
        val decoded = json.decodeFromString<Novel>(encoded)

        assertEquals(original, decoded)
        // episodeOrder is the source of truth for ordering: order must survive the round-trip.
        assertEquals(original.episodeOrder, decoded.episodeOrder)
    }

    @Test
    fun novel_synopsis_defaults_to_empty_when_absent() {
        // single-shot novel with no synopsis still decodes via the default.
        val encoded = """{"id":"01NVL-xyz","title":"単発","episodeOrder":["ep-9"],""" +
            """"createdAt":1700000000000,"updatedAt":1700000000000}"""
        val decoded = json.decodeFromString<Novel>(encoded)

        assertEquals("", decoded.synopsis)
        assertEquals(listOf(EpisodeId("ep-9")), decoded.episodeOrder)
    }

    @Test
    fun episode_round_trips_through_json() {
        val original = Episode(
            id = EpisodeId("ep-1"),
            novelId = NovelId("01NVL-abc"),
            title = "第一話",
            body = "本文。名前はまだ無い。😺",
            createdAt = 1_700_000_000_000L,
            updatedAt = 1_700_000_123_456L,
        )

        val encoded = json.encodeToString(original)
        val decoded = json.decodeFromString<Episode>(encoded)

        assertEquals(original, decoded)
    }

    @Test
    fun novel_and_episode_summaries_round_trip_through_json() {
        val novelSummary = NovelSummary(
            id = NovelId("01NVL-abc"),
            title = "連載小説",
            episodeCount = 3,
            updatedAt = 1_700_000_999_999L,
        )
        val episodeSummary = EpisodeSummary(
            id = EpisodeId("ep-2"),
            title = "第二話",
            updatedAt = 1_700_000_888_888L,
        )

        assertEquals(novelSummary, json.decodeFromString<NovelSummary>(json.encodeToString(novelSummary)))
        assertEquals(episodeSummary, json.decodeFromString<EpisodeSummary>(json.encodeToString(episodeSummary)))
    }
}
