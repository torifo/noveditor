import type { Manuscript, ManuscriptSummary } from 'noveditor-core'

export type { Manuscript, ManuscriptSummary }

/**
 * TypeScript mirror of the Kotlin `ManuscriptRepository` port
 * (`dev.noveditor.core.repository.ManuscriptRepository`).
 *
 * The Kotlin interface is intentionally NOT `@JsExport`ed (a `suspend` contract is awkward
 * across the JS boundary), so the web adapter re-declares it here and implements persistence
 * directly in TypeScript. Methods are async to match the `suspend` semantics.
 */
export interface ManuscriptRepository {
  /** All summaries (order unspecified). `[]` if none. */
  list(): Promise<ManuscriptSummary[]>
  /** Full manuscript by id, or `null` if not found. */
  load(id: string): Promise<Manuscript | null>
  /** Insert or overwrite by id. */
  save(m: Manuscript): Promise<void>
  /** Remove by id. No-op if absent. */
  delete(id: string): Promise<void>
}

/** Thrown when the underlying storage operation fails (e.g. quota exceeded, serialization error). */
export class RepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'RepositoryError'
    if (options?.cause !== undefined) {
      this.cause = options.cause
    }
  }
}
