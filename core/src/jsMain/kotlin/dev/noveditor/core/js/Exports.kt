@file:OptIn(ExperimentalJsExport::class)

package dev.noveditor.core.js

import dev.noveditor.core.stats.countStats as countStatsInternal

/**
 * `@JsExport`ed surface consumed by the web (TypeScript) adapter.
 *
 * `@JsExport` lives only in the Kotlin/JS stdlib, so the exported declarations live in `jsMain`
 * (not `commonMain`, which must also compile for the JVM test target). These types mirror the
 * canonical [model][dev.noveditor.core.model] shapes but use JS-idiomatic types: `String` ids
 * (instead of the `ManuscriptId` value class) and `Double` epoch-millis timestamps (instead of
 * `Long`, which is not a plain JS `number`). Epoch millis fit a JS safe-integer `number`.
 *
 * Note: the `ManuscriptRepository` port is intentionally NOT exported — a `suspend` contract is
 * awkward across the JS boundary, and the web adapter implements persistence directly in
 * TypeScript, mirroring that Kotlin interface itself.
 */
@JsExport
data class DocumentStats(
    val charCount: Int,
    val charCountNoWhitespace: Int,
    val lineCount: Int,
    val paragraphCount: Int,
)

/** JS-friendly mirror of [dev.noveditor.core.model.Manuscript] (string id, number timestamps). */
@JsExport
data class Manuscript(
    val id: String,
    val title: String,
    val body: String,
    val createdAt: Double,
    val updatedAt: Double,
)

/** JS-friendly mirror of [dev.noveditor.core.model.ManuscriptSummary] (list metadata, no body). */
@JsExport
data class ManuscriptSummary(
    val id: String,
    val title: String,
    val updatedAt: Double,
)

/**
 * Computes [DocumentStats] for [text]. Thin `@JsExport` wrapper over the pure `commonMain`
 * implementation; counting is code-point based (a surrogate pair counts as one character).
 */
@JsExport
fun countStats(text: String): DocumentStats {
    val stats = countStatsInternal(text)
    return DocumentStats(
        charCount = stats.charCount,
        charCountNoWhitespace = stats.charCountNoWhitespace,
        lineCount = stats.lineCount,
        paragraphCount = stats.paragraphCount,
    )
}
