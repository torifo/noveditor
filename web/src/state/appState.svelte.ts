import {
  Episode,
  Novel,
  type EpisodeSummary,
  type NovelSummary,
} from 'noveditor-core'
import { LocalStorageNovelRepository } from '../repository/LocalStorageNovelRepository'
import type { EpisodeSearchHit, NovelRepository } from '../repository/NovelRepository'
import { runNovelEpisodeMigration } from '../repository/migration'
import { Debouncer } from './autosave'
import { createEpisode, createNovel } from './novelFactory'
import { SAMPLE_NOVEL_ID, isSampleEpisode, isSampleNovel, seedSampleNovel } from './sampleNovel'

const AUTOSAVE_DELAY_MS = 800

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/** Snapshot kept alive while an undo toast is showing, so deletion can be reversed. */
type DeletedBackup =
  | { kind: 'episode'; episode: Episode; novelId: string; index: number }
  | { kind: 'novel'; novel: Novel; episodes: Episode[] }

/**
 * App-wide editing state (Svelte 5 runes) for the 小説(Novel) → 話(Episode) hierarchy.
 *
 * Owns the current editing buffer (the active 話's id/title/body/createdAt), the novel list and
 * the current novel's episode list, autosave, and the single `save` path shared by autosave and
 * the explicit Save button. `updatedAt` is injected here (`Date.now()`) on every save; saving an
 * episode also bumps its parent novel's `updatedAt` so the novel list stays recency-sorted.
 *
 * Startup migrates any legacy flat 原稿 store, then opens the novel with the max `updatedAt` and
 * its most-recently-updated 話. With no novels it begins empty (the editor shows its CTA).
 */
export class AppState {
  // ---- Novel list + current novel's episode list ----
  novels = $state<NovelSummary[]>([])
  episodes = $state<EpisodeSummary[]>([])

  currentNovelId = $state<string | null>(null)
  currentEpisodeId = $state<string | null>(null)

  // Current novel meta (for the breadcrumb + novel-title editing).
  novelTitle = $state('')
  novelSynopsis = $state('')
  // 小説共通のお知らせ（冒頭）／あとがき（末尾）— 全話の本文前後に表示。
  novelForeNote = $state('')
  novelAfterNote = $state('')

  // Editing buffer for the current 話 (never discarded on save failure).
  title = $state('')
  body = $state('')
  // 話ごとのお知らせ（冒頭）／あとがき（末尾）。
  foreNote = $state('')
  afterNote = $state('')
  private episodeCreatedAt = 0

  saveStatus = $state<SaveStatus>('idle')
  errorMessage = $state<string | null>(null)

  // Undoable delete (novel or episode): a non-blocking toast offers "元に戻す" for ~5s.
  toast = $state<{ message: string } | null>(null)
  private deletedBackup: DeletedBackup | null = null

  // Focus coordination: bumping `focusSignal` asks the editor to focus `focusTarget`.
  focusSignal = $state(0)
  focusTarget = $state<'title' | 'body'>('body')

  /** Ask the editor to move focus to the title or body on the next tick. */
  requestFocus(target: 'title' | 'body'): void {
    this.focusTarget = target
    this.focusSignal++
  }

  /** `true` when a novel is open with at least one episode being edited. */
  /** The user's own novels — everything except the built-in 使い方 guide. */
  get userNovels(): NovelSummary[] {
    return this.novels.filter((n) => n.id !== SAMPLE_NOVEL_ID)
  }

  get hasEpisode(): boolean {
    return this.currentEpisodeId !== null
  }

  private readonly repo: NovelRepository
  private readonly autosaver = new Debouncer(AUTOSAVE_DELAY_MS, () => {
    void this.saveNow()
  })

  constructor(repo: NovelRepository = new LocalStorageNovelRepository()) {
    this.repo = repo
  }

  // ---- Startup ----

  /** Migrate legacy data, load the list and open the most-recently-updated novel/episode. */
  async init(): Promise<void> {
    try {
      await runNovelEpisodeMigration(this.repo)
    } catch (e) {
      // Migration failure is non-fatal: keep the (possibly empty) novel list and notify.
      this.fail('既存データの移行に失敗しました。データは保持されています。', e)
    }
    // Seed the built-in 使い方 guide novel once (best-effort; never blocks startup).
    try {
      await seedSampleNovel(this.repo)
    } catch {
      /* ignore — the guide simply won't appear this session */
    }
    await this.refreshNovels()
    const latest = this.latestNovel()
    if (latest) {
      await this.openNovel(latest.id)
    } else {
      this.clearBuffer()
    }
  }

  private latestNovel(): NovelSummary | null {
    // Exclude the built-in guide so it never auto-opens or counts as the user's latest work.
    const own = this.novels.filter((n) => n.id !== SAMPLE_NOVEL_ID)
    if (own.length === 0) return null
    return own.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
  }

  private async refreshNovels(): Promise<void> {
    try {
      const list = await this.repo.listNovels()
      this.novels = [...list].sort((a, b) => b.updatedAt - a.updatedAt)
    } catch (e) {
      this.fail('小説一覧の読み込みに失敗しました', e)
    }
  }

  private async refreshEpisodes(novelId: string): Promise<void> {
    try {
      this.episodes = await this.repo.listEpisodes(novelId)
    } catch (e) {
      this.fail('話一覧の読み込みに失敗しました', e)
    }
  }

  /** Clear the editing buffer (no novel/episode open). */
  private clearBuffer(): void {
    this.currentNovelId = null
    this.currentEpisodeId = null
    this.episodes = []
    this.novelTitle = ''
    this.novelSynopsis = ''
    this.novelForeNote = ''
    this.novelAfterNote = ''
    this.title = ''
    this.body = ''
    this.foreNote = ''
    this.afterNote = ''
    this.episodeCreatedAt = 0
    this.saveStatus = 'idle'
    this.errorMessage = null
  }

  // ---- Editing / autosave ----

  /** Called by the editor on every title/body edit: marks dirty and schedules autosave. */
  markEdited(): void {
    if (this.currentEpisodeId === null) return
    this.errorMessage = null
    this.saveStatus = 'dirty'
    this.autosaver.schedule()
  }

  /**
   * The single save path (autosave + explicit Save both call this). Persists the current 話 with
   * `updatedAt = now`, then bumps the parent novel's `updatedAt` (and mirrors the title onto a
   * single-episode novel whose title is still empty, so 単発 novels keep one title).
   */
  async saveNow(): Promise<void> {
    this.autosaver.cancel()
    const episodeId = this.currentEpisodeId
    const novelId = this.currentNovelId
    if (episodeId === null || novelId === null) return
    this.saveStatus = 'saving'
    const now = Date.now()
    const episode = new Episode(
      episodeId,
      novelId,
      this.title,
      this.body,
      this.episodeCreatedAt,
      now,
      this.foreNote,
      this.afterNote,
    )
    try {
      await this.repo.saveEpisode(episode)
      await this.touchNovel(novelId, now)
      this.saveStatus = 'saved'
      this.errorMessage = null
      await this.refreshNovels()
      await this.refreshEpisodes(novelId)
    } catch (e) {
      // Do NOT discard the editing buffer on failure.
      this.fail('保存に失敗しました。編集内容は保持されています。', e)
    }
  }

  /** Bump a novel's updatedAt; mirror the episode title onto a still-untitled single-話 novel. */
  private async touchNovel(novelId: string, now: number): Promise<void> {
    const novel = await this.repo.loadNovel(novelId)
    if (novel === null) return
    const single = novel.episodeOrder.length === 1
    const novelTitle = single && novel.title.trim().length === 0 ? this.title : novel.title
    const next = new Novel(
      novel.id,
      novelTitle,
      novel.synopsis,
      novel.episodeOrder,
      novel.createdAt,
      now,
      novel.foreNote,
      novel.afterNote,
    )
    await this.repo.saveNovel(next)
    if (novelId === this.currentNovelId) this.novelTitle = novelTitle
  }

  /** Flush a pending/dirty buffer through the save path before navigating away. */
  private async persistPending(): Promise<void> {
    if (this.currentEpisodeId !== null && (this.saveStatus === 'dirty' || this.autosaver.pending)) {
      await this.saveNow()
    }
  }

  // ---- Navigation ----

  /** Open a novel and its default 話 (most-recently-updated, else first in order). */
  async openNovel(novelId: string): Promise<void> {
    await this.persistPending()
    try {
      const novel = await this.repo.loadNovel(novelId)
      if (novel === null) {
        await this.refreshNovels()
        const latest = this.latestNovel()
        if (latest && latest.id !== novelId) await this.openNovel(latest.id)
        else this.clearBuffer()
        return
      }
      this.currentNovelId = novel.id
      this.novelTitle = novel.title
      this.novelSynopsis = novel.synopsis
      this.novelForeNote = novel.foreNote
      this.novelAfterNote = novel.afterNote
      await this.refreshEpisodes(novel.id)
      const target = this.defaultEpisodeId()
      if (target) {
        await this.loadEpisodeInto(target)
        this.requestFocus(this.title.trim().length > 0 ? 'body' : 'title')
      } else {
        // Novel with no episodes — shouldn't normally happen, but stay consistent.
        this.currentEpisodeId = null
        this.title = ''
        this.body = ''
        this.foreNote = ''
        this.afterNote = ''
        this.episodeCreatedAt = 0
        this.saveStatus = 'idle'
      }
    } catch (e) {
      this.fail('小説の読み込みに失敗しました', e)
    }
  }

  /** The default 話 to open for the current novel: latest updatedAt, else first in order. */
  private defaultEpisodeId(): string | null {
    if (this.episodes.length === 0) return null
    const latest = this.episodes.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
    return latest.id
  }

  /** Switch to another 話 within the current novel (autosave current first). */
  async openEpisode(episodeId: string): Promise<void> {
    if (episodeId === this.currentEpisodeId && this.saveStatus !== 'dirty') {
      return
    }
    await this.persistPending()
    await this.loadEpisodeInto(episodeId)
    this.requestFocus(this.title.trim().length > 0 ? 'body' : 'title')
  }

  /** Load an episode into the buffer WITHOUT persisting the current one (caller handles that). */
  private async loadEpisodeInto(episodeId: string): Promise<void> {
    try {
      const ep = await this.repo.loadEpisode(episodeId)
      if (ep === null) {
        // Vanished — refresh the episode list and fall back to a sibling.
        if (this.currentNovelId) await this.refreshEpisodes(this.currentNovelId)
        const fallback = this.defaultEpisodeId()
        if (fallback && fallback !== episodeId) {
          await this.loadEpisodeInto(fallback)
        } else {
          this.currentEpisodeId = null
          this.title = ''
          this.body = ''
          this.foreNote = ''
          this.afterNote = ''
          this.episodeCreatedAt = 0
          this.saveStatus = 'idle'
        }
        return
      }
      this.currentNovelId = ep.novelId
      this.currentEpisodeId = ep.id
      this.title = ep.title
      this.body = ep.body
      this.foreNote = ep.foreNote
      this.afterNote = ep.afterNote
      this.episodeCreatedAt = ep.createdAt
      this.saveStatus = 'idle'
      this.errorMessage = null
    } catch (e) {
      this.fail('話の読み込みに失敗しました', e)
    }
  }

  // ---- Creation ----

  /** Create a new 小説 with one empty 話, open it, and focus the title. */
  async createNovel(): Promise<void> {
    await this.persistPending()
    try {
      const novel = createNovel()
      const episode = createEpisode(novel.id)
      const novelWithEpisode = new Novel(
        novel.id,
        novel.title,
        novel.synopsis,
        [episode.id],
        novel.createdAt,
        novel.updatedAt,
      )
      await this.repo.saveEpisode(episode)
      await this.repo.saveNovel(novelWithEpisode)
      await this.refreshNovels()
      this.currentNovelId = novel.id
      this.novelTitle = novel.title
      this.novelSynopsis = novel.synopsis
      this.novelForeNote = novel.foreNote
      this.novelAfterNote = novel.afterNote
      await this.refreshEpisodes(novel.id)
      await this.loadEpisodeInto(episode.id)
      this.requestFocus('title')
    } catch (e) {
      this.fail('小説の作成に失敗しました', e)
    }
  }

  /**
   * Create a new 話 in the current novel (⌘N / ＋新規話) and open it. With no current novel this
   * falls back to creating a new novel.
   */
  async createEpisode(): Promise<void> {
    const novelId = this.currentNovelId
    if (novelId === null) {
      await this.createNovel()
      return
    }
    await this.persistPending()
    try {
      const novel = await this.repo.loadNovel(novelId)
      if (novel === null) {
        await this.createNovel()
        return
      }
      const episode = createEpisode(novelId)
      const next = new Novel(
        novel.id,
        novel.title,
        novel.synopsis,
        [...novel.episodeOrder, episode.id],
        novel.createdAt,
        Date.now(),
        novel.foreNote,
        novel.afterNote,
      )
      await this.repo.saveEpisode(episode)
      await this.repo.saveNovel(next)
      await this.refreshNovels()
      await this.refreshEpisodes(novelId)
      await this.loadEpisodeInto(episode.id)
      this.requestFocus('title')
    } catch (e) {
      this.fail('話の作成に失敗しました', e)
    }
  }

  // ---- Reorder ----

  /** Move a 話 one slot up (-1) or down (+1) within its novel and persist the new order. */
  async moveEpisode(episodeId: string, delta: -1 | 1): Promise<void> {
    const novelId = this.currentNovelId
    if (novelId === null) return
    try {
      const novel = await this.repo.loadNovel(novelId)
      if (novel === null) return
      const order = [...novel.episodeOrder]
      const from = order.indexOf(episodeId)
      const to = from + delta
      if (from < 0 || to < 0 || to >= order.length) return
      ;[order[from], order[to]] = [order[to], order[from]]
      const next = new Novel(
        novel.id,
        novel.title,
        novel.synopsis,
        order,
        novel.createdAt,
        Date.now(),
        novel.foreNote,
        novel.afterNote,
      )
      await this.repo.saveNovel(next)
      await this.refreshNovels()
      await this.refreshEpisodes(novelId)
    } catch (e) {
      this.fail('並べ替えに失敗しました', e)
    }
  }

  /**
   * Reorder a 話 by absolute indices within its novel and persist the new order.
   * Used by drag-and-drop. `fromIndex` and `toIndex` are positions in `episodeOrder`
   * after the splice-and-insert: the element is removed from `fromIndex` first, then
   * inserted at `toIndex` in the resulting array.
   */
  async reorderEpisode(novelId: string, fromIndex: number, toIndex: number): Promise<void> {
    if (fromIndex === toIndex) return
    try {
      const novel = await this.repo.loadNovel(novelId)
      if (novel === null) return
      const order = [...novel.episodeOrder]
      if (fromIndex < 0 || fromIndex >= order.length || toIndex < 0 || toIndex >= order.length) return
      const [moved] = order.splice(fromIndex, 1)
      order.splice(toIndex, 0, moved)
      const next = new Novel(
        novel.id,
        novel.title,
        novel.synopsis,
        order,
        novel.createdAt,
        Date.now(),
        novel.foreNote,
        novel.afterNote,
      )
      await this.repo.saveNovel(next)
      await this.refreshNovels()
      await this.refreshEpisodes(novelId)
    } catch (e) {
      this.fail('並べ替えに失敗しました', e)
    }
  }

  // ---- Search (⌘K command palette) ----

  /** Full-text search across all novels' episodes (delegates to the repo). `[]` on blank/failure. */
  async search(query: string): Promise<EpisodeSearchHit[]> {
    try {
      return await this.repo.searchEpisodes(query)
    } catch (e) {
      // A failed search must not flip the save indicator to an error state.
      console.error('[noveditor] 検索に失敗しました', e)
      return []
    }
  }

  /** Jump to any episode (opens its parent novel first when it's not the current one). */
  async goToEpisode(novelId: string, episodeId: string): Promise<void> {
    if (novelId !== this.currentNovelId) {
      await this.openNovel(novelId)
    }
    await this.openEpisode(episodeId)
  }

  // ---- Novel meta editing ----

  /** Fetch a novel's editable meta (title + synopsis), reading the body for non-current novels. */
  async getNovelMeta(
    novelId: string,
  ): Promise<{ title: string; synopsis: string; foreNote: string; afterNote: string }> {
    if (novelId === this.currentNovelId) {
      return {
        title: this.novelTitle,
        synopsis: this.novelSynopsis,
        foreNote: this.novelForeNote,
        afterNote: this.novelAfterNote,
      }
    }
    try {
      const novel = await this.repo.loadNovel(novelId)
      return {
        title: novel?.title ?? '',
        synopsis: novel?.synopsis ?? '',
        foreNote: novel?.foreNote ?? '',
        afterNote: novel?.afterNote ?? '',
      }
    } catch (e) {
      this.fail('小説情報の読み込みに失敗しました', e)
      return { title: '', synopsis: '', foreNote: '', afterNote: '' }
    }
  }

  /** Update the current (or given) novel's title/synopsis/お知らせ/あとがき. */
  async updateNovelMeta(
    novelId: string,
    title: string,
    synopsis: string,
    foreNote: string,
    afterNote: string,
  ): Promise<void> {
    try {
      const novel = await this.repo.loadNovel(novelId)
      if (novel === null) return
      const next = new Novel(
        novel.id,
        title,
        synopsis,
        novel.episodeOrder,
        novel.createdAt,
        Date.now(),
        foreNote,
        afterNote,
      )
      await this.repo.saveNovel(next)
      await this.refreshNovels()
      if (novelId === this.currentNovelId) {
        this.novelTitle = title
        this.novelSynopsis = synopsis
        this.novelForeNote = foreNote
        this.novelAfterNote = afterNote
      }
    } catch (e) {
      this.fail('小説情報の更新に失敗しました', e)
    }
  }

  // ---- Deletion + undo ----

  /** Delete a 話; if it was current, move to a sibling. Offers an undo toast. */
  async removeEpisode(episodeId: string): Promise<void> {
    if (isSampleEpisode(episodeId)) {
      this.toast = { message: 'この使い方サンプルの話は削除できません' }
      return
    }
    let novelId = this.currentNovelId
    let backup: Episode | null = null
    let index = -1
    try {
      backup = await this.repo.loadEpisode(episodeId)
      if (backup) novelId = backup.novelId
    } catch {
      backup = null
    }
    if (novelId) {
      try {
        const novel = await this.repo.loadNovel(novelId)
        if (novel) index = novel.episodeOrder.indexOf(episodeId)
      } catch {
        index = -1
      }
    }
    try {
      await this.repo.deleteEpisode(episodeId)
    } catch (e) {
      this.fail('削除に失敗しました', e)
      return
    }
    await this.refreshNovels()
    if (novelId) await this.refreshEpisodes(novelId)

    if (episodeId === this.currentEpisodeId) {
      this.autosaver.cancel()
      const fallback = this.defaultEpisodeId()
      if (fallback) {
        await this.loadEpisodeInto(fallback)
      } else {
        // No episodes left in this novel — fall back to the latest remaining novel (or empty).
        const latest = this.latestNovel()
        if (latest) await this.openNovel(latest.id)
        else this.clearBuffer()
      }
    }
    if (backup && novelId) {
      this.deletedBackup = { kind: 'episode', episode: backup, novelId, index: index < 0 ? 0 : index }
      const t = backup.title.trim().length > 0 ? backup.title : '（無題）'
      this.toast = { message: `話「${t}」を削除しました` }
    }
  }

  /** Delete a 小説 and all its 話; if it was current, move to the latest remaining novel. */
  async removeNovel(novelId: string): Promise<void> {
    if (isSampleNovel(novelId)) {
      this.toast = { message: 'この使い方サンプルは削除できません' }
      return
    }
    let novel: Novel | null = null
    const episodes: Episode[] = []
    try {
      novel = await this.repo.loadNovel(novelId)
      if (novel) {
        for (const id of novel.episodeOrder) {
          const ep = await this.repo.loadEpisode(id)
          if (ep) episodes.push(ep)
        }
      }
    } catch {
      novel = null
    }
    try {
      await this.repo.deleteNovel(novelId)
    } catch (e) {
      this.fail('削除に失敗しました', e)
      return
    }
    await this.refreshNovels()
    if (novelId === this.currentNovelId) {
      this.autosaver.cancel()
      const latest = this.latestNovel()
      if (latest) await this.openNovel(latest.id)
      else this.clearBuffer()
    }
    if (novel) {
      this.deletedBackup = { kind: 'novel', novel, episodes }
      const t = novel.title.trim().length > 0 ? novel.title : '（無題の小説）'
      this.toast = { message: `小説「${t}」を削除しました` }
    }
  }

  /** Restore the last deleted novel/episode and re-select it. */
  async undoDelete(): Promise<void> {
    const backup = this.deletedBackup
    if (backup === null) return
    this.deletedBackup = null
    this.toast = null
    try {
      if (backup.kind === 'episode') {
        await this.repo.saveEpisode(backup.episode)
        const novel = await this.repo.loadNovel(backup.novelId)
        if (novel && !novel.episodeOrder.includes(backup.episode.id)) {
          const order = [...novel.episodeOrder]
          order.splice(Math.min(backup.index, order.length), 0, backup.episode.id)
          await this.repo.saveNovel(
            new Novel(
              novel.id,
              novel.title,
              novel.synopsis,
              order,
              novel.createdAt,
              Date.now(),
              novel.foreNote,
              novel.afterNote,
            ),
          )
        }
        await this.refreshNovels()
        await this.openNovel(backup.novelId)
        await this.openEpisode(backup.episode.id)
      } else {
        for (const ep of backup.episodes) await this.repo.saveEpisode(ep)
        await this.repo.saveNovel(backup.novel)
        await this.refreshNovels()
        await this.openNovel(backup.novel.id)
      }
    } catch (e) {
      this.fail('元に戻せませんでした', e)
    }
  }

  /** Dismiss the undo toast; the deletion becomes final and the snapshot is dropped. */
  dismissToast(): void {
    this.deletedBackup = null
    this.toast = null
  }

  private fail(message: string, cause: unknown): void {
    console.error('[noveditor]', message, cause)
    this.saveStatus = 'error'
    this.errorMessage = message
  }
}
