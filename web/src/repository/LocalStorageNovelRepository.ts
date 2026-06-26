import { Episode, EpisodeSummary, Novel, NovelSummary } from 'noveditor-core'
import { RepositoryError } from './ManuscriptRepository'
import type { NovelRepository } from './NovelRepository'

/**
 * `localStorage`-backed {@link NovelRepository} for the 小説(Novel) → 話(Episode) hierarchy.
 *
 * Key layout:
 *  - `noveditor:novels`            — array of {@link NovelSummary} (the novel index, JSON)
 *  - `noveditor:novel:<novelId>`   — full {@link Novel} (meta + episodeOrder, JSON)
 *  - `noveditor:episode:<id>`      — full {@link Episode} (JSON)
 *
 * Consistency (no atomicity available — same discipline as the flat repo):
 *  - `saveNovel` writes the novel body key FIRST, then upserts the index. A crash in between
 *    leaves an orphan novel body rather than a dangling index entry.
 *  - `saveEpisode` only writes the episode body. The parent `episodeOrder` is owned by the novel
 *    (`saveNovel`); a newly created episode is appended to the order by the caller.
 *  - `deleteEpisode` removes the episode body FIRST, then drops the id from the parent order.
 *  - `deleteNovel` removes every episode body FIRST, then the novel body, then the index entry.
 *  - `listNovels` / `listEpisodes` reconcile and SELF-HEAL: index entries whose novel body is
 *    missing are dropped; `episodeOrder` ids whose episode body is missing are filtered out (and
 *    the novel rewritten); orphan bodies not referenced anywhere are never surfaced.
 *
 * `title`/`updatedAt`/`episodeCount` are duplicated between the index summary and the novel body;
 * `saveNovel` always keeps them equal.
 */
export const NOVELS_INDEX_KEY = 'noveditor:novels'
export const NOVEL_KEY_PREFIX = 'noveditor:novel:'
export const EPISODE_KEY_PREFIX = 'noveditor:episode:'

const novelKey = (id: string): string => `${NOVEL_KEY_PREFIX}${id}`
const episodeKey = (id: string): string => `${EPISODE_KEY_PREFIX}${id}`

interface NovelDto {
  id: string
  title: string
  synopsis: string
  episodeOrder: string[]
  createdAt: number
  updatedAt: number
}

interface EpisodeDto {
  id: string
  novelId: string
  title: string
  body: string
  createdAt: number
  updatedAt: number
}

interface NovelSummaryDto {
  id: string
  title: string
  episodeCount: number
  updatedAt: number
}

function toNovelDto(n: Novel): NovelDto {
  return {
    id: n.id,
    title: n.title,
    synopsis: n.synopsis,
    episodeOrder: [...n.episodeOrder],
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }
}

function fromNovelDto(dto: NovelDto): Novel {
  return new Novel(dto.id, dto.title, dto.synopsis, [...dto.episodeOrder], dto.createdAt, dto.updatedAt)
}

function toEpisodeDto(e: Episode): EpisodeDto {
  return {
    id: e.id,
    novelId: e.novelId,
    title: e.title,
    body: e.body,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

function fromEpisodeDto(dto: EpisodeDto): Episode {
  return new Episode(dto.id, dto.novelId, dto.title, dto.body, dto.createdAt, dto.updatedAt)
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function isNovelDto(v: unknown): v is NovelDto {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.synopsis === 'string' &&
    isStringArray(o.episodeOrder) &&
    typeof o.createdAt === 'number' &&
    typeof o.updatedAt === 'number'
  )
}

function isEpisodeDto(v: unknown): v is EpisodeDto {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.novelId === 'string' &&
    typeof o.title === 'string' &&
    typeof o.body === 'string' &&
    typeof o.createdAt === 'number' &&
    typeof o.updatedAt === 'number'
  )
}

function isNovelSummaryDto(v: unknown): v is NovelSummaryDto {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.episodeCount === 'number' &&
    typeof o.updatedAt === 'number'
  )
}

export class LocalStorageNovelRepository implements NovelRepository {
  private readonly storage: Storage

  constructor(storage: Storage = globalThis.localStorage) {
    if (!storage) {
      throw new RepositoryError('localStorage is not available in this environment')
    }
    this.storage = storage
  }

  // ---- raw helpers ----

  private readIndex(): NovelSummaryDto[] {
    let raw: string | null
    try {
      raw = this.storage.getItem(NOVELS_INDEX_KEY)
    } catch (cause) {
      throw new RepositoryError('Failed to read novel index', { cause })
    }
    if (raw === null) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (cause) {
      console.warn('[noveditor] novel index is corrupt; resetting to empty', cause)
      return []
    }
    if (!Array.isArray(parsed)) {
      console.warn('[noveditor] novel index is not an array; resetting to empty')
      return []
    }
    return parsed.filter((e): e is NovelSummaryDto => {
      const ok = isNovelSummaryDto(e)
      if (!ok) console.warn('[noveditor] skipping malformed novel index entry', e)
      return ok
    })
  }

  private writeIndex(entries: NovelSummaryDto[]): void {
    try {
      this.storage.setItem(NOVELS_INDEX_KEY, JSON.stringify(entries))
    } catch (cause) {
      throw new RepositoryError('Failed to write novel index', { cause })
    }
  }

  private readNovel(id: string): NovelDto | null {
    let raw: string | null
    try {
      raw = this.storage.getItem(novelKey(id))
    } catch (cause) {
      throw new RepositoryError(`Failed to read novel ${id}`, { cause })
    }
    if (raw === null) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (cause) {
      console.warn(`[noveditor] novel ${id} body is corrupt; treating as missing`, cause)
      return null
    }
    if (!isNovelDto(parsed)) {
      console.warn(`[noveditor] novel ${id} body has unexpected shape; treating as missing`)
      return null
    }
    return parsed
  }

  private readEpisode(id: string): EpisodeDto | null {
    let raw: string | null
    try {
      raw = this.storage.getItem(episodeKey(id))
    } catch (cause) {
      throw new RepositoryError(`Failed to read episode ${id}`, { cause })
    }
    if (raw === null) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (cause) {
      console.warn(`[noveditor] episode ${id} body is corrupt; treating as missing`, cause)
      return null
    }
    if (!isEpisodeDto(parsed)) {
      console.warn(`[noveditor] episode ${id} body has unexpected shape; treating as missing`)
      return null
    }
    return parsed
  }

  private hasEpisode(id: string): boolean {
    try {
      return this.storage.getItem(episodeKey(id)) !== null
    } catch (cause) {
      throw new RepositoryError(`Failed to read episode body ${id}`, { cause })
    }
  }

  private writeNovelDto(dto: NovelDto): void {
    try {
      this.storage.setItem(novelKey(dto.id), JSON.stringify(dto))
    } catch (cause) {
      throw new RepositoryError(`Failed to save novel ${dto.id}`, { cause })
    }
  }

  private upsertIndex(dto: NovelDto): void {
    const summary: NovelSummaryDto = {
      id: dto.id,
      title: dto.title,
      episodeCount: dto.episodeOrder.length,
      updatedAt: dto.updatedAt,
    }
    const entries = this.readIndex()
    const idx = entries.findIndex((e) => e.id === dto.id)
    if (idx >= 0) entries[idx] = summary
    else entries.push(summary)
    this.writeIndex(entries)
  }

  // ---- Novel API ----

  async listNovels(): Promise<NovelSummary[]> {
    const entries = this.readIndex()
    const reconciled: NovelSummaryDto[] = []
    let changed = false
    for (const e of entries) {
      const novel = this.readNovel(e.id)
      if (novel === null) {
        // Self-heal: index references a missing novel body — drop it.
        changed = true
        continue
      }
      // Keep the summary's episodeCount in sync with the (existing) episodes.
      const liveCount = novel.episodeOrder.filter((id) => this.hasEpisode(id)).length
      if (e.episodeCount !== liveCount || e.title !== novel.title || e.updatedAt !== novel.updatedAt) {
        changed = true
      }
      reconciled.push({
        id: novel.id,
        title: novel.title,
        episodeCount: liveCount,
        updatedAt: novel.updatedAt,
      })
    }
    if (changed) {
      console.warn('[noveditor] self-heal: reconciled novel index')
      this.writeIndex(reconciled)
    }
    return reconciled.map((e) => new NovelSummary(e.id, e.title, e.episodeCount, e.updatedAt))
  }

  async loadNovel(id: string): Promise<Novel | null> {
    const dto = this.readNovel(id)
    return dto === null ? null : fromNovelDto(dto)
  }

  async saveNovel(novel: Novel): Promise<void> {
    const dto = toNovelDto(novel)
    // 1. Write the novel body FIRST so the index never references a missing body.
    this.writeNovelDto(dto)
    // 2. Upsert the index (title/updatedAt/episodeCount kept equal to the body).
    this.upsertIndex(dto)
  }

  async deleteNovel(id: string): Promise<void> {
    const novel = this.readNovel(id)
    // 1. Remove every episode body FIRST (cascade).
    if (novel !== null) {
      for (const epId of novel.episodeOrder) {
        try {
          this.storage.removeItem(episodeKey(epId))
        } catch (cause) {
          throw new RepositoryError(`Failed to delete episode ${epId}`, { cause })
        }
      }
    }
    // 2. Remove the novel body.
    try {
      this.storage.removeItem(novelKey(id))
    } catch (cause) {
      throw new RepositoryError(`Failed to delete novel ${id}`, { cause })
    }
    // 3. Drop the summary from the index.
    const entries = this.readIndex()
    const next = entries.filter((e) => e.id !== id)
    if (next.length !== entries.length) {
      this.writeIndex(next)
    }
  }

  // ---- Episode API ----

  async listEpisodes(novelId: string): Promise<EpisodeSummary[]> {
    const novel = this.readNovel(novelId)
    if (novel === null) return []
    const summaries: EpisodeSummary[] = []
    const liveOrder: string[] = []
    for (const id of novel.episodeOrder) {
      const ep = this.readEpisode(id)
      if (ep === null) continue // self-heal: drop dangling order entry below
      liveOrder.push(id)
      summaries.push(new EpisodeSummary(ep.id, ep.title, ep.updatedAt))
    }
    if (liveOrder.length !== novel.episodeOrder.length) {
      console.warn(
        `[noveditor] self-heal: dropped ${novel.episodeOrder.length - liveOrder.length} dangling episode ref(s) from novel ${novelId}`,
      )
      this.writeNovelDto({ ...novel, episodeOrder: liveOrder })
      this.upsertIndex({ ...novel, episodeOrder: liveOrder })
    }
    return summaries
  }

  async loadEpisode(id: string): Promise<Episode | null> {
    const dto = this.readEpisode(id)
    return dto === null ? null : fromEpisodeDto(dto)
  }

  async saveEpisode(episode: Episode): Promise<void> {
    try {
      this.storage.setItem(episodeKey(episode.id), JSON.stringify(toEpisodeDto(episode)))
    } catch (cause) {
      throw new RepositoryError(`Failed to save episode ${episode.id}`, { cause })
    }
  }

  async deleteEpisode(id: string): Promise<void> {
    // Learn the parent novel BEFORE removing the body (the body carries novelId).
    const ep = this.readEpisode(id)
    // 1. Remove the episode body FIRST.
    try {
      this.storage.removeItem(episodeKey(id))
    } catch (cause) {
      throw new RepositoryError(`Failed to delete episode ${id}`, { cause })
    }
    // 2. Drop the id from the parent novel's episodeOrder.
    const parentId = ep?.novelId ?? this.findNovelContaining(id)
    if (parentId === null) return
    const novel = this.readNovel(parentId)
    if (novel === null) return
    if (!novel.episodeOrder.includes(id)) return
    const next: NovelDto = { ...novel, episodeOrder: novel.episodeOrder.filter((x) => x !== id) }
    this.writeNovelDto(next)
    this.upsertIndex(next)
  }

  /** Fallback when an episode body is already gone: scan novels for one referencing the id. */
  private findNovelContaining(episodeId: string): string | null {
    for (const e of this.readIndex()) {
      const novel = this.readNovel(e.id)
      if (novel && novel.episodeOrder.includes(episodeId)) return novel.id
    }
    return null
  }
}
