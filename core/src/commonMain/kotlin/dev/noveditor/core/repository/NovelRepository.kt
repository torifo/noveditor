package dev.noveditor.core.repository

import dev.noveditor.core.model.Episode
import dev.noveditor.core.model.EpisodeId
import dev.noveditor.core.model.EpisodeSummary
import dev.noveditor.core.model.Novel
import dev.noveditor.core.model.NovelId
import dev.noveditor.core.model.NovelSummary

/**
 * Persistence port for the 連載（小説→話）structure (FR-NE02).
 *
 * `core` defines only this contract; the concrete persistence (LocalStorage on web,
 * Room/DataStore on Android, a sync/MCP backend later) is supplied by an adapter. Keeping
 * `core` I/O-free is what makes the three-layer separation hold.
 *
 * Episode ordering is owned by [Novel.episodeOrder]; the episode operations here read and mutate
 * that order as documented per method (no order field lives on [Episode]).
 *
 * This interface is **not** `@JsExport`ed: a `suspend` contract is awkward across the JS boundary,
 * and the web adapter implements persistence directly in TypeScript, mirroring these signatures.
 * It coexists with the legacy [ManuscriptRepository], which is retired in a later wave.
 */
interface NovelRepository {
    /**
     * Lists metadata for all stored novels.
     *
     * @return every stored novel as a [NovelSummary]; an empty list when none exist (never
     *   `null`). Order is unspecified by the contract and left to the implementation (callers
     *   typically sort by [NovelSummary.updatedAt]).
     */
    suspend fun listNovels(): List<NovelSummary>

    /**
     * Loads a single novel by id (metadata + [Novel.episodeOrder]; no episode bodies).
     *
     * @param id the novel to load.
     * @return the matching [Novel], or `null` if no novel with [id] exists.
     */
    suspend fun loadNovel(id: NovelId): Novel?

    /**
     * Persists [novel] — its metadata and [Novel.episodeOrder] — inserting it when new or
     * overwriting the existing record with the same [Novel.id]. Saving the novel is also how an
     * episode reorder is committed (FR-NE02), since order lives in [Novel.episodeOrder].
     * Callers set [Novel.updatedAt]; `core` holds no clock.
     */
    suspend fun saveNovel(novel: Novel)

    /**
     * Deletes the novel with [id] together with all of its episodes (cascading delete).
     * A no-op (not an error) when no such novel exists.
     */
    suspend fun deleteNovel(id: NovelId)

    /**
     * Lists metadata for the episodes of one novel, in [Novel.episodeOrder] sequence.
     *
     * @param novelId the parent novel.
     * @return the novel's episodes as [EpisodeSummary] ordered per [Novel.episodeOrder]; an empty
     *   list when the novel has no episodes or does not exist (never `null`).
     */
    suspend fun listEpisodes(novelId: NovelId): List<EpisodeSummary>

    /**
     * Loads a single episode by id (including [Episode.body]).
     *
     * @param id the episode to load.
     * @return the matching [Episode], or `null` if no episode with [id] exists.
     */
    suspend fun loadEpisode(id: EpisodeId): Episode?

    /**
     * Persists [episode], inserting it when new or overwriting the existing record with the same
     * [Episode.id]. Appending a brand-new episode to its novel's [Novel.episodeOrder] is the
     * caller's responsibility via [saveNovel]; this call writes only the episode body/metadata.
     * Callers set [Episode.updatedAt]; `core` holds no clock.
     */
    suspend fun saveEpisode(episode: Episode)

    /**
     * Deletes the episode with [id] and removes it from its parent [Novel.episodeOrder].
     * A no-op (not an error) when no such episode exists.
     */
    suspend fun deleteEpisode(id: EpisodeId)
}
