import { beforeEach, describe, expect, it } from 'vitest'
import { Manuscript } from 'noveditor-core'
import { LocalStorageManuscriptRepository } from './LocalStorageManuscriptRepository'
import { LocalStorageNovelRepository } from './LocalStorageNovelRepository'
import { MIGRATION_FLAG_KEY, runNovelEpisodeMigration } from './migration'

/** Deterministic novelId generator for assertions. */
function seqIds(prefix = 'nid'): () => string {
  let n = 0
  return () => `${prefix}-${++n}`
}

describe('runNovelEpisodeMigration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates each legacy manuscript into a 1-話 novel, preserving identity', async () => {
    const legacy = new LocalStorageManuscriptRepository(localStorage)
    await legacy.save(new Manuscript('m1', '原稿その一', '本文1', 1000, 1500))
    await legacy.save(new Manuscript('m2', '原稿その二', '本文2', 2000, 2500))

    const repo = new LocalStorageNovelRepository(localStorage)
    const result = await runNovelEpisodeMigration(repo, { storage: localStorage, newId: seqIds() })

    expect(result).toEqual({ ran: true, migrated: 2 })

    const novels = await repo.listNovels()
    expect(novels).toHaveLength(2)
    expect(novels.every((n) => n.episodeCount === 1)).toBe(true)

    // The episode preserves the original manuscript id/title/body/timestamps.
    const ep = await repo.loadEpisode('m1')
    expect(ep).not.toBeNull()
    expect(ep!.title).toBe('原稿その一')
    expect(ep!.body).toBe('本文1')
    expect(ep!.createdAt).toBe(1000)
    expect(ep!.updatedAt).toBe(1500)

    // Its parent novel has a fresh id and points at the episode.
    const novel = await repo.loadNovel(ep!.novelId)
    expect(novel).not.toBeNull()
    expect(novel!.title).toBe('原稿その一')
    expect(novel!.episodeOrder).toEqual(['m1'])

    // Flag is set.
    expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe('1')
  })

  it('is idempotent: a second run does nothing', async () => {
    const legacy = new LocalStorageManuscriptRepository(localStorage)
    await legacy.save(new Manuscript('m1', 'T', 'B', 1, 1))

    const repo = new LocalStorageNovelRepository(localStorage)
    const first = await runNovelEpisodeMigration(repo, { storage: localStorage, newId: seqIds() })
    expect(first).toEqual({ ran: true, migrated: 1 })

    const before = await repo.listNovels()
    const second = await runNovelEpisodeMigration(repo, { storage: localStorage, newId: seqIds('x') })
    expect(second).toEqual({ ran: false, migrated: 0 })
    const after = await repo.listNovels()
    expect(after.map((n) => n.id).sort()).toEqual(before.map((n) => n.id).sort())
  })

  it('does not destroy the legacy keys (kept as backup)', async () => {
    const legacy = new LocalStorageManuscriptRepository(localStorage)
    await legacy.save(new Manuscript('m1', 'T', 'B', 1, 1))

    const repo = new LocalStorageNovelRepository(localStorage)
    await runNovelEpisodeMigration(repo, { storage: localStorage, newId: seqIds() })

    // Legacy manuscript is still loadable.
    expect(await legacy.load('m1')).not.toBeNull()
  })

  it('sets the flag (and migrates 0) when there is no legacy data', async () => {
    const repo = new LocalStorageNovelRepository(localStorage)
    const result = await runNovelEpisodeMigration(repo, { storage: localStorage, newId: seqIds() })
    expect(result).toEqual({ ran: true, migrated: 0 })
    expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe('1')
  })
})
