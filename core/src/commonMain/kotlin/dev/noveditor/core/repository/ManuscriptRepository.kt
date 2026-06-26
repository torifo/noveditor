package dev.noveditor.core.repository

import dev.noveditor.core.model.Manuscript
import dev.noveditor.core.model.ManuscriptId
import dev.noveditor.core.model.ManuscriptSummary

/**
 * Persistence port for manuscripts (FR-003).
 *
 * `core` defines only this contract; the concrete persistence (LocalStorage on web,
 * Room/DataStore on Android, a sync/MCP backend later) is supplied by an adapter. Keeping
 * `core` I/O-free is what makes the three-layer separation hold.
 *
 * This interface is **not** `@JsExport`ed: a `suspend` contract is awkward across the JS
 * boundary, and the web adapter implements persistence directly in TypeScript, mirroring
 * these signatures itself.
 */
interface ManuscriptRepository {
    /**
     * Lists metadata for all stored manuscripts.
     *
     * @return every stored manuscript as a [ManuscriptSummary]; an empty list when none exist
     *   (never `null`). Order is unspecified by the contract and left to the implementation.
     */
    suspend fun list(): List<ManuscriptSummary>

    /**
     * Loads a single manuscript by id.
     *
     * @param id the manuscript to load.
     * @return the matching [Manuscript], or `null` if no manuscript with [id] exists.
     */
    suspend fun load(id: ManuscriptId): Manuscript?

    /**
     * Persists [manuscript], inserting it when new or overwriting the existing record with the
     * same [Manuscript.id]. Callers set [Manuscript.updatedAt]; `core` holds no clock.
     */
    suspend fun save(manuscript: Manuscript)

    /**
     * Deletes the manuscript with [id]. A no-op (not an error) when no such manuscript exists.
     */
    suspend fun delete(id: ManuscriptId)
}
