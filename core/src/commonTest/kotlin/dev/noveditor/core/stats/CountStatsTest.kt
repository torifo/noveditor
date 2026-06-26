package dev.noveditor.core.stats

import dev.noveditor.core.model.DocumentStats
import kotlin.test.Test
import kotlin.test.assertEquals

class CountStatsTest {

    private data class Case(
        val name: String,
        val text: String,
        val expected: DocumentStats,
    )

    // Emoji (astral plane, surrogate pair in UTF-16): U+1F63A SMILING CAT FACE.
    // Built from explicit surrogate code units so the test is independent of source encoding.
    private val catEmoji = "\uD83D\uDE3A"

    // Variation-selector kanji: 葛 (U+845B, BMP) + VS17 (U+E0100 -> surrogate pair).
    // Two code points; the variation selector is itself a surrogate pair in UTF-16.
    private val vsKanji = "\u845B\uDB40\uDD00"

    private val cases = listOf(
        Case(
            name = "empty",
            text = "",
            expected = DocumentStats(0, 0, 0, 0),
        ),
        Case(
            name = "halfwidth ascii word",
            text = "hello",
            expected = DocumentStats(5, 5, 1, 1),
        ),
        Case(
            name = "fullwidth japanese",
            text = "こんにちは",
            expected = DocumentStats(5, 5, 1, 1),
        ),
        Case(
            name = "halfwidth with spaces",
            text = "a b c",
            expected = DocumentStats(5, 3, 1, 1),
        ),
        Case(
            name = "fullwidth ideographic space stripped",
            text = "あ　い",
            expected = DocumentStats(3, 2, 1, 1),
        ),
        Case(
            name = "newlines only (single)",
            text = "\n",
            expected = DocumentStats(1, 0, 1, 0),
        ),
        Case(
            name = "newlines only (triple) -> two blank lines",
            text = "\n\n\n",
            expected = DocumentStats(3, 0, 3, 0),
        ),
        Case(
            name = "two content lines",
            text = "abc\ndef",
            expected = DocumentStats(7, 6, 2, 1),
        ),
        Case(
            name = "trailing newline does not add a phantom line",
            text = "abc\ndef\n",
            expected = DocumentStats(8, 6, 2, 1),
        ),
        Case(
            name = "crlf normalized",
            text = "abc\r\ndef",
            expected = DocumentStats(8, 6, 2, 1),
        ),
        Case(
            name = "single emoji counts as one codepoint",
            text = catEmoji,
            expected = DocumentStats(1, 1, 1, 1),
        ),
        Case(
            name = "variation-selector kanji counts as two codepoints",
            // base kanji (1) + variation selector codepoint (1) = 2
            text = vsKanji,
            expected = DocumentStats(2, 2, 1, 1),
        ),
        Case(
            name = "mixed ascii, kanji, emoji and spaces",
            // 'A'(1) ' '(1,ws) '猫'(1) emoji(1) = 4 codepoints, 3 non-whitespace
            text = "A 猫$catEmoji",
            expected = DocumentStats(4, 3, 1, 1),
        ),
        Case(
            name = "two paragraphs separated by one blank line",
            text = "first\n\nsecond",
            expected = DocumentStats(13, 11, 3, 2),
        ),
        Case(
            name = "two paragraphs separated by multiple blank lines",
            text = "first\n\n\nsecond",
            expected = DocumentStats(14, 11, 4, 2),
        ),
        Case(
            name = "whitespace-only line acts as paragraph separator",
            text = "first\n  \nsecond",
            expected = DocumentStats(15, 11, 3, 2),
        ),
        Case(
            name = "leading and trailing blank lines ignored for paragraphs",
            text = "\n\nonly\n\n",
            expected = DocumentStats(8, 4, 4, 1),
        ),
    )

    @Test
    fun count_stats_table() {
        for (case in cases) {
            assertEquals(case.expected, countStats(case.text), "case='${case.name}'")
        }
    }
}
