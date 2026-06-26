import { Manuscript, type ManuscriptSummary } from 'noveditor-core'
import { LocalStorageManuscriptRepository } from '../repository/LocalStorageManuscriptRepository'
import type { ManuscriptRepository } from '../repository/ManuscriptRepository'
import { Debouncer } from './autosave'
import { createManuscript } from './manuscriptFactory'

const AUTOSAVE_DELAY_MS = 800

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/**
 * App-wide editing state (Svelte 5 runes). Owns the current editing buffer (id/title/body/
 * createdAt), the manuscript list, autosave, and the single `save` path shared by autosave and
 * the explicit Save button. `updatedAt` is injected here (`Date.now()`) on every save.
 *
 * Startup opens the manuscript with the max `updatedAt`; if none exists it begins with a fresh
 * (unpersisted) buffer.
 */
export class AppState {
  summaries = $state<ManuscriptSummary[]>([])

  // Editing buffer (never discarded on save failure).
  currentId = $state<string | null>(null)
  private createdAt = 0
  title = $state('')
  body = $state('')

  saveStatus = $state<SaveStatus>('idle')
  errorMessage = $state<string | null>(null)

  // Undoable delete: a non-blocking toast offers "元に戻す" for ~5s. The deleted manuscript is
  // kept in memory (`deletedBackup`) until the toast is dismissed (auto or manual), at which
  // point the deletion becomes final. Undo re-`save()`s the snapshot via the repository.
  toast = $state<{ message: string } | null>(null)
  private deletedBackup: Manuscript | null = null

  // Focus coordination: bumping `focusSignal` asks the editor to focus `focusTarget`
  // (so the user can start writing immediately after creating/switching manuscripts).
  focusSignal = $state(0)
  focusTarget = $state<'title' | 'body'>('body')

  /** Ask the editor to move focus to the title or body on the next tick. */
  requestFocus(target: 'title' | 'body'): void {
    this.focusTarget = target
    this.focusSignal++
  }

  private readonly repo: ManuscriptRepository
  private readonly autosaver = new Debouncer(AUTOSAVE_DELAY_MS, () => {
    void this.saveNow()
  })

  constructor(repo: ManuscriptRepository = new LocalStorageManuscriptRepository()) {
    this.repo = repo
  }

  /** Load the list and open the most-recently-updated manuscript (or a fresh buffer). */
  async init(): Promise<void> {
    await this.refreshList()
    const latest = this.latestSummary()
    if (latest) {
      await this.open(latest.id)
    } else {
      this.resetBuffer()
    }
  }

  private latestSummary(): ManuscriptSummary | null {
    if (this.summaries.length === 0) return null
    return this.summaries.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
  }

  private async refreshList(): Promise<void> {
    try {
      const list = await this.repo.list()
      // Sort by updatedAt desc for stable display.
      this.summaries = [...list].sort((a, b) => b.updatedAt - a.updatedAt)
    } catch (e) {
      this.fail('一覧の読み込みに失敗しました', e)
    }
  }

  /** Fresh, unpersisted buffer (empty initial state). */
  private resetBuffer(): void {
    const m = createManuscript()
    this.currentId = m.id
    this.createdAt = m.createdAt
    this.title = ''
    this.body = ''
    this.saveStatus = 'idle'
    this.errorMessage = null
  }

  /** Called by the editor on every title/body edit: marks dirty and schedules autosave. */
  markEdited(): void {
    this.errorMessage = null
    this.saveStatus = 'dirty'
    this.autosaver.schedule()
  }

  /** The single save path (autosave + explicit Save both call this). Injects `updatedAt = now`. */
  async saveNow(): Promise<void> {
    this.autosaver.cancel()
    const id = this.currentId
    if (id === null) return
    this.saveStatus = 'saving'
    const m = new Manuscript(id, this.title, this.body, this.createdAt, Date.now())
    try {
      await this.repo.save(m)
      this.saveStatus = 'saved'
      this.errorMessage = null
      await this.refreshList()
    } catch (e) {
      // Do NOT discard the editing buffer on failure.
      this.fail('保存に失敗しました。編集内容は保持されています。', e)
    }
  }

  /** Create a new manuscript: persist any pending edits, then start a fresh buffer. */
  async createNew(): Promise<void> {
    await this.persistPending()
    this.resetBuffer()
    // Fresh buffer is untitled — focus the title so the user can name & write at once.
    this.requestFocus('title')
  }

  /** Switch to another manuscript: autosave current first, then load the selected one. */
  async open(id: string): Promise<void> {
    if (id === this.currentId && this.saveStatus !== 'dirty') {
      // already open and clean — but still (re)load to be safe on first open
    }
    await this.persistPending()
    try {
      const m = await this.repo.load(id)
      if (m === null) {
        // Vanished (e.g. concurrent delete / self-heal) — refresh and fall back.
        await this.refreshList()
        const latest = this.latestSummary()
        if (latest && latest.id !== id) {
          await this.open(latest.id)
        } else {
          this.resetBuffer()
        }
        return
      }
      this.currentId = m.id
      this.createdAt = m.createdAt
      this.title = m.title
      this.body = m.body
      this.saveStatus = 'idle'
      this.errorMessage = null
      // Drop into the body to keep writing; if it's still untitled, name it first.
      this.requestFocus(this.title.trim().length > 0 ? 'body' : 'title')
    } catch (e) {
      this.fail('原稿の読み込みに失敗しました', e)
    }
  }

  /**
   * Delete a manuscript; if it was the current one, move to the latest remaining (or empty).
   * Snapshots the manuscript first and surfaces a non-blocking undo toast (no native confirm).
   */
  async remove(id: string): Promise<void> {
    // Snapshot before deletion so an Undo can re-persist the exact manuscript.
    let backup: Manuscript | null = null
    try {
      backup = await this.repo.load(id)
    } catch {
      backup = null
    }
    try {
      await this.repo.delete(id)
    } catch (e) {
      this.fail('削除に失敗しました', e)
      return
    }
    await this.refreshList()
    if (id === this.currentId) {
      this.autosaver.cancel() // buffer is gone; drop any pending autosave
      const latest = this.latestSummary()
      if (latest) {
        // open() would try to persist the just-deleted buffer; load directly instead.
        await this.loadInto(latest.id)
      } else {
        this.resetBuffer()
      }
    }
    // One toast at a time — a new deletion finalizes any previous undo offer.
    if (backup) {
      this.deletedBackup = backup
      const t = backup.title.trim().length > 0 ? backup.title : '（無題）'
      this.toast = { message: `「${t}」を削除しました` }
    }
  }

  /** Restore the last deleted manuscript (re-`save()` the snapshot) and re-select it. */
  async undoDelete(): Promise<void> {
    const backup = this.deletedBackup
    if (backup === null) return
    this.deletedBackup = null
    this.toast = null
    try {
      await this.repo.save(backup)
      await this.refreshList()
      await this.loadInto(backup.id)
    } catch (e) {
      this.fail('元に戻せませんでした', e)
    }
  }

  /** Dismiss the undo toast; the deletion becomes final and the snapshot is dropped. */
  dismissToast(): void {
    this.deletedBackup = null
    this.toast = null
  }

  private async loadInto(id: string): Promise<void> {
    try {
      const m = await this.repo.load(id)
      if (m === null) {
        this.resetBuffer()
        return
      }
      this.currentId = m.id
      this.createdAt = m.createdAt
      this.title = m.title
      this.body = m.body
      this.saveStatus = 'idle'
      this.errorMessage = null
    } catch (e) {
      this.fail('原稿の読み込みに失敗しました', e)
    }
  }

  /** Flush a pending/dirty buffer through the save path before navigating away. */
  private async persistPending(): Promise<void> {
    if (this.saveStatus === 'dirty' || this.autosaver.pending) {
      await this.saveNow()
    }
  }

  private fail(message: string, cause: unknown): void {
    console.error('[noveditor]', message, cause)
    this.saveStatus = 'error'
    this.errorMessage = message
  }
}
