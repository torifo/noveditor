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
 * JS-friendly mirror of [dev.noveditor.core.model.Novel] for the 連載（小説→話）structure.
 *
 * Ids ([id]) are plain `String` (not the `NovelId` value class) and [episodeOrder] is a
 * `string[]` of episode ids; timestamps are `Double` epoch-millis (a JS `number`). The web
 * adapter implements `NovelRepository` itself in TypeScript, so only the data shape is exported.
 */
@JsExport
data class Novel(
    val id: String,
    val title: String,
    val synopsis: String,
    val episodeOrder: Array<String>,
    val createdAt: Double,
    val updatedAt: Double,
    // 小説共通の前書き／後書き（全話の本文前後に表示）。空＝非表示。末尾＋既定値で後方互換。
    val foreNote: String = "",
    val afterNote: String = "",
)

/**
 * JS-friendly mirror of [dev.noveditor.core.model.Episode] (string ids, number timestamps).
 * [novelId] is the parent novel's id as a `String`.
 */
@JsExport
data class Episode(
    val id: String,
    val novelId: String,
    val title: String,
    val body: String,
    val createdAt: Double,
    val updatedAt: Double,
    // 話ごとの前書き（お知らせ）／後書き（あとがき）。空＝非表示。末尾＋既定値で後方互換。
    val foreNote: String = "",
    val afterNote: String = "",
)

/** JS-friendly mirror of [dev.noveditor.core.model.NovelSummary] (list metadata, no bodies). */
@JsExport
data class NovelSummary(
    val id: String,
    val title: String,
    val episodeCount: Int,
    val updatedAt: Double,
)

/** JS-friendly mirror of [dev.noveditor.core.model.EpisodeSummary] (list metadata, no body). */
@JsExport
data class EpisodeSummary(
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
