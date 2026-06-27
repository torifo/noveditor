import type { Episode, EpisodeSummary, Novel, NovelSummary } from 'noveditor-core'

export type { Episode, EpisodeSummary, Novel, NovelSummary }

/**
 * A single hit from {@link NovelRepository.searchEpisodes}. Powers the ⌘K command palette's
 * "move/search" results: jumping to an episode by matching its novel title, its own title, or
 * its body text.
 */
export interface EpisodeSearchHit {
  novelId: string
  episodeId: string
  novelTitle: string
  episodeTitle: string
  /** Where the query matched, in priority order: novel title → episode title → body. */
  matchedIn: 'novel' | 'title' | 'body'
  /** A short excerpt for display: body context around the match, else the matched title. */
  snippet: string
}

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

  /**
   * Full-text search across ALL novels' episodes: matches on novel title, episode title, and
   * body. Case-insensitive (ASCII-folded; Japanese matched as substrings). A blank/whitespace
   * query returns `[]`. Hits are ordered by match priority (novel title → episode title → body),
   * then by the episode's `updatedAt` (most recent first).
   */
  searchEpisodes(query: string): Promise<EpisodeSearchHit[]>
}
