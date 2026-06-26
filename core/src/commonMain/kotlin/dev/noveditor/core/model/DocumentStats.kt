package dev.noveditor.core.model

/**
 * Aggregate statistics computed from a manuscript body.
 *
 * All counts are code-point based where relevant (see
 * [countStats][dev.noveditor.core.stats.countStats]). Fields are [Int].
 *
 * This is the canonical `commonMain` type. The web adapter consumes a `@JsExport`ed mirror of
 * the same shape from `jsMain` (see `dev.noveditor.core.js`).
 *
 * @property charCount total character count, counting a surrogate pair (emoji, rare kanji) as 1.
 * @property charCountNoWhitespace [charCount] excluding Unicode whitespace and `\n` / `\r`.
 * @property lineCount number of newline-separated lines; `0` for empty text.
 * @property paragraphCount number of blocks separated by one or more blank lines
 *   (computed for v1 features; hidden in the MVP UI).
 */
data class DocumentStats(
    val charCount: Int,
    val charCountNoWhitespace: Int,
    val lineCount: Int,
    val paragraphCount: Int,
)
