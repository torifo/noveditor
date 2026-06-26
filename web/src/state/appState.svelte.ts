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
    } catch (e) {
      this.fail('原稿の読み込みに失敗しました', e)
    }
  }

  /** Delete a manuscript; if it was the current one, move to the latest remaining (or empty). */
  async remove(id: string): Promise<void> {
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
