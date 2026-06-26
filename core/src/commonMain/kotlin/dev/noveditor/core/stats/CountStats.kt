package dev.noveditor.core.stats

import dev.noveditor.core.model.DocumentStats

/**
 * Computes [DocumentStats] for [text] as a pure function (no clock, no I/O).
 *
 * Counting is **code-point based**: a UTF-16 surrogate pair (emoji, third-level kanji,
 * variation-selector sequences are counted per code point) is treated as a single character,
 * never iterated by [Char]. This matches how authors perceive character counts in Japanese text.
 *
 * Line and paragraph counting normalize `\r\n` and lone `\r` to `\n` first:
 * - [DocumentStats.lineCount]: number of newline-separated lines; a single trailing newline does
 *   not add a phantom empty line. Empty text is `0`.
 * - [DocumentStats.paragraphCount]: maximal runs of non-blank lines, separated by one or more
 *   blank (empty or whitespace-only) lines.
 *
 * This is the canonical `commonMain` implementation (JVM + JS). The web adapter calls a
 * `@JsExport`ed wrapper of the same name from `jsMain` (see `dev.noveditor.core.js`).
 */
fun countStats(text: String): DocumentStats {
    if (text.isEmpty()) {
        return DocumentStats(
            charCount = 0,
            charCountNoWhitespace = 0,
            lineCount = 0,
            paragraphCount = 0,
        )
    }

    var charCount = 0
    var charCountNoWhitespace = 0
    var i = 0
    while (i < text.length) {
        val c = text[i]
        val isSurrogatePair = c.isHighSurrogate() &&
            i + 1 < text.length &&
            text[i + 1].isLowSurrogate()

        if (isSurrogatePair) {
            // Astral-plane code point: a single character, never whitespace.
            charCount++
            charCountNoWhitespace++
            i += 2
        } else {
            charCount++
            if (!c.isWhitespace()) {
                charCountNoWhitespace++
            }
            i += 1
        }
    }

    val normalized = text.replace("\r\n", "\n").replace('\r', '\n')
    val rawLines = normalized.split('\n')
    // A single trailing newline produces a final empty element we don't count as a line.
    val lines = if (rawLines.size > 1 && rawLines.last().isEmpty()) {
        rawLines.subList(0, rawLines.size - 1)
    } else {
        rawLines
    }
    val lineCount = lines.size

    var paragraphCount = 0
    var inParagraph = false
    for (line in lines) {
        if (line.isBlank()) {
            inParagraph = false
        } else if (!inParagraph) {
            paragraphCount++
            inParagraph = true
        }
    }

    return DocumentStats(
        charCount = charCount,
        charCountNoWhitespace = charCountNoWhitespace,
        lineCount = lineCount,
        paragraphCount = paragraphCount,
    )
}
