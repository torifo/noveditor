import { Episode, Novel } from 'noveditor-core'
import { LocalStorageManuscriptRepository } from './LocalStorageManuscriptRepository'
import type { NovelRepository } from './NovelRepository'

/**
 * FR-NE04 — one-time migration of the legacy flat 原稿 store into the 小説→話 hierarchy.
 *
 * Each old `Manuscript` becomes a 1-話 `Novel`:
 *  - the `Episode` preserves the manuscript id/title/body/createdAt/updatedAt,
 *  - a fresh `novelId` is minted, with `episodeOrder = [episodeId]`.
 *
 * Idempotent: a one-shot flag (`noveditor:migrated:novel-episodes`) guards re-entry. Old keys
 * (`noveditor:index`, `noveditor:manuscript:*`) are intentionally left in place as a backup.
 */
export const MIGRATION_FLAG_KEY = 'noveditor:migrated:novel-episodes'

export interface MigrationResult {
  /** `true` if the migration ran this call (flag was previously unset). */
  ran: boolean
  /** Number of manuscripts migrated into 1-話 novels. */
  migrated: number
}

export async function runNovelEpisodeMigration(
  repo: NovelRepository,
  options: {
    storage?: Storage
    /** novelId generator (the web adapter owns id minting). */
    newId?: () => string
  } = {},
): Promise<MigrationResult> {
  const storage = options.storage ?? globalThis.localStorage
  const newId = options.newId ?? (() => crypto.randomUUID())

  // Idempotency: never run twice.
  if (storage.getItem(MIGRATION_FLAG_KEY) !== null) {
    return { ran: false, migrated: 0 }
  }

  let migrated = 0
  try {
    const legacy = new LocalStorageManuscriptRepository(storage)
    const summaries = await legacy.list()
    for (const s of summaries) {
      const man = await legacy.load(s.id)
      if (man === null) continue
      const novelId = newId()
      // Episode preserves the original manuscript identity (id/title/body/timestamps).
      const episode = new Episode(man.id, novelId, man.title, man.body, man.createdAt, man.updatedAt)
      const novel = new Novel(novelId, man.title, '', [man.id], man.createdAt, man.updatedAt)
      // Body-first: episode before the novel that references it.
      await repo.saveEpisode(episode)
      await repo.saveNovel(novel)
      migrated++
    }
  } catch (cause) {
    // FR / error handling: do NOT destroy legacy data; surface the failure and let the app fall
    // back to whatever novels exist. The flag is left UNSET so a future load can retry.
    console.error('[noveditor] novel-episode migration failed; legacy data preserved', cause)
    throw cause
  }

  // Mark complete only on success.
  storage.setItem(MIGRATION_FLAG_KEY, '1')
  return { ran: true, migrated }
}
