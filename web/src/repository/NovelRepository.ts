import type { Episode, EpisodeSummary, Novel, NovelSummary } from 'noveditor-core'

export type { Episode, EpisodeSummary, Novel, NovelSummary }

/**
 * TypeScript mirror of the Kotlin `NovelRepository` port
 * (`dev.noveditor.core.repository.NovelRepository`).
 *
 * As with {@link ManuscriptRepository}, the Kotlin `suspend` contract is awkward across the JS
 * boundary, so the web adapter re-declares the port here and implements persistence directly in
 * TypeScript. Methods are async to match the `suspend` semantics.
 *
 * 階層: 小説(Novel) → 話(Episode)。順序の源泉は `Novel.episodeOrder`（話は order を持たない）。
 */
export interface NovelRepository {
  /** All novel summaries (order unspecified). `[]` if none. */
  listNovels(): Promise<NovelSummary[]>
  /** Full novel (meta + episodeOrder) by id, or `null` if not found. */
  loadNovel(id: string): Promise<Novel | null>
  /** Insert or overwrite a novel (meta + episodeOrder) by id. */
  saveNovel(novel: Novel): Promise<void>
  /** Remove a novel and ALL of its episodes (cascade). No-op if absent. */
  deleteNovel(id: string): Promise<void>

  /** Episodes of a novel, returned in `Novel.episodeOrder` order. `[]` if the novel is unknown. */
  listEpisodes(novelId: string): Promise<EpisodeSummary[]>
  /** Full episode by id, or `null` if not found. */
  loadEpisode(id: string): Promise<Episode | null>
  /** Insert or overwrite an episode by id. Does NOT touch the parent `episodeOrder`. */
  saveEpisode(episode: Episode): Promise<void>
  /** Remove an episode and drop its id from the parent `Novel.episodeOrder`. No-op if absent. */
  deleteEpisode(id: string): Promise<void>
}
