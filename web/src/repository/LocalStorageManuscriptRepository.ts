import { Manuscript, ManuscriptSummary } from 'noveditor-core'
import {
  type ManuscriptRepository,
  RepositoryError,
} from './ManuscriptRepository'

/**
 * `localStorage`-backed {@link ManuscriptRepository}.
 *
 * Key layout:
 *  - `noveditor:manuscript:<id>` — full manuscript body (JSON)
 *  - `noveditor:index`           — array of {@link ManuscriptSummary} (JSON)
 *
 * Consistency (no atomicity available):
 *  - `save` writes the body key FIRST, then updates the index. A crash between the two leaves
 *    an orphan body (in storage but not in the index) rather than a dangling index entry.
 *  - `delete` removes the body key FIRST, then drops the summary from the index. A crash between
 *    the two leaves a dangling index entry whose body is missing.
 *  - `list` reconciles index <-> body keys and SELF-HEALS: index entries whose body is missing
 *    are dropped (and the index is rewritten); orphan bodies not referenced by the index are
 *    skipped (never surfaced).
 *
 * `title`/`updatedAt` are duplicated between the index summary and the body; `save` always keeps
 * them equal.
 */
export const INDEX_KEY = 'noveditor:index'
export const BODY_KEY_PREFIX = 'noveditor:manuscript:'

const bodyKey = (id: string): string => `${BODY_KEY_PREFIX}${id}`

/** Plain serializable shape persisted for a manuscript body. */
interface ManuscriptDto {
  id: string
  title: string
  body: string
  createdAt: number
  updatedAt: number
}

/** Plain serializable shape persisted per index entry. */
interface SummaryDto {
  id: string
  title: string
  updatedAt: number
}

function toManuscriptDto(m: Manuscript): ManuscriptDto {
  return {
    id: m.id,
    title: m.title,
    body: m.body,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }
}

function fromManuscriptDto(dto: ManuscriptDto): Manuscript {
  return new Manuscript(dto.id, dto.title, dto.body, dto.createdAt, dto.updatedAt)
}

function toSummaryDto(m: Manuscript): SummaryDto {
  return { id: m.id, title: m.title, updatedAt: m.updatedAt }
}

function fromSummaryDto(dto: SummaryDto): ManuscriptSummary {
  return new ManuscriptSummary(dto.id, dto.title, dto.updatedAt)
}

function isManuscriptDto(v: unknown): v is ManuscriptDto {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.body === 'string' &&
    typeof o.createdAt === 'number' &&
    typeof o.updatedAt === 'number'
  )
}

function isSummaryDto(v: unknown): v is SummaryDto {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.updatedAt === 'number'
  )
}

export class LocalStorageManuscriptRepository implements ManuscriptRepository {
  private readonly storage: Storage

  constructor(storage: Storage = globalThis.localStorage) {
    if (!storage) {
      throw new RepositoryError('localStorage is not available in this environment')
    }
    this.storage = storage
  }

  /** Reads + parses the raw index. Malformed/invalid entries are dropped (logged). */
  private readIndex(): SummaryDto[] {
    let raw: string | null
    try {
      raw = this.storage.getItem(INDEX_KEY)
    } catch (cause) {
      throw new RepositoryError('Failed to read manuscript index', { cause })
    }
    if (raw === null) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (cause) {
      console.warn('[noveditor] manuscript index is corrupt; resetting to empty', cause)
      return []
    }
    if (!Array.isArray(parsed)) {
      console.warn('[noveditor] manuscript index is not an array; resetting to empty')
      return []
    }
    return parsed.filter((e): e is SummaryDto => {
      const ok = isSummaryDto(e)
      if (!ok) console.warn('[noveditor] skipping malformed index entry', e)
      return ok
    })
  }

  private writeIndex(entries: SummaryDto[]): void {
    try {
      this.storage.setItem(INDEX_KEY, JSON.stringify(entries))
    } catch (cause) {
      throw new RepositoryError('Failed to write manuscript index', { cause })
    }
  }

  private hasBody(id: string): boolean {
    try {
      return this.storage.getItem(bodyKey(id)) !== null
    } catch (cause) {
      throw new RepositoryError(`Failed to read manuscript body ${id}`, { cause })
    }
  }

  async list(): Promise<ManuscriptSummary[]> {
    const entries = this.readIndex()
    // Self-heal: drop index entries whose body key is missing.
    const reconciled = entries.filter((e) => this.hasBody(e.id))
    if (reconciled.length !== entries.length) {
      console.warn(
        `[noveditor] self-heal: dropped ${entries.length - reconciled.length} index entr(ies) with missing body`,
      )
      this.writeIndex(reconciled)
    }
    return reconciled.map(fromSummaryDto)
  }

  async load(id: string): Promise<Manuscript | null> {
    let raw: string | null
    try {
      raw = this.storage.getItem(bodyKey(id))
    } catch (cause) {
      throw new RepositoryError(`Failed to read manuscript ${id}`, { cause })
    }
    if (raw === null) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (cause) {
      console.warn(`[noveditor] manuscript ${id} body is corrupt; treating as missing`, cause)
      return null
    }
    if (!isManuscriptDto(parsed)) {
      console.warn(`[noveditor] manuscript ${id} body has unexpected shape; treating as missing`)
      return null
    }
    return fromManuscriptDto(parsed)
  }

  async save(m: Manuscript): Promise<void> {
    // 1. Write the body FIRST so the index never references a missing body.
    try {
      this.storage.setItem(bodyKey(m.id), JSON.stringify(toManuscriptDto(m)))
    } catch (cause) {
      throw new RepositoryError(`Failed to save manuscript ${m.id}`, { cause })
    }
    // 2. Upsert the summary in the index (title/updatedAt kept equal to the body).
    const summary = toSummaryDto(m)
    const entries = this.readIndex()
    const idx = entries.findIndex((e) => e.id === m.id)
    if (idx >= 0) entries[idx] = summary
    else entries.push(summary)
    this.writeIndex(entries)
  }

  async delete(id: string): Promise<void> {
    // 1. Remove the body FIRST.
    try {
      this.storage.removeItem(bodyKey(id))
    } catch (cause) {
      throw new RepositoryError(`Failed to delete manuscript ${id}`, { cause })
    }
    // 2. Drop the summary from the index.
    const entries = this.readIndex()
    const next = entries.filter((e) => e.id !== id)
    if (next.length !== entries.length) {
      this.writeIndex(next)
    }
  }
}
