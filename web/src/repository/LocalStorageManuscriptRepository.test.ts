import { beforeEach, describe, expect, it } from 'vitest'
import { Manuscript } from 'noveditor-core'
import {
  BODY_KEY_PREFIX,
  INDEX_KEY,
  LocalStorageManuscriptRepository,
} from './LocalStorageManuscriptRepository'

const m = (
  id: string,
  title: string,
  body: string,
  createdAt: number,
  updatedAt: number,
): Manuscript => new Manuscript(id, title, body, createdAt, updatedAt)

describe('LocalStorageManuscriptRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips save -> load -> list -> delete', async () => {
    const repo = new LocalStorageManuscriptRepository(localStorage)

    expect(await repo.list()).toEqual([])
    expect(await repo.load('missing')).toBeNull()

    const a = m('a', 'タイトルA', '本文A', 1000, 1000)
    const b = m('b', 'タイトルB', '本文B', 2000, 2000)
    await repo.save(a)
    await repo.save(b)

    const loadedA = await repo.load('a')
    expect(loadedA).not.toBeNull()
    expect(loadedA!.id).toBe('a')
    expect(loadedA!.title).toBe('タイトルA')
    expect(loadedA!.body).toBe('本文A')
    expect(loadedA!.createdAt).toBe(1000)
    expect(loadedA!.updatedAt).toBe(1000)

    const summaries = await repo.list()
    expect(summaries.map((s) => s.id).sort()).toEqual(['a', 'b'])
    const sumB = summaries.find((s) => s.id === 'b')!
    expect(sumB.title).toBe('タイトルB')
    expect(sumB.updatedAt).toBe(2000)

    await repo.delete('a')
    expect(await repo.load('a')).toBeNull()
    expect((await repo.list()).map((s) => s.id)).toEqual(['b'])

    // delete is a no-op when absent
    await expect(repo.delete('a')).resolves.toBeUndefined()
  })

  it('overwrites by id and keeps index title/updatedAt in sync with body', async () => {
    const repo = new LocalStorageManuscriptRepository(localStorage)
    await repo.save(m('a', '旧タイトル', '旧本文', 1000, 1000))
    await repo.save(m('a', '新タイトル', '新本文', 1000, 5000))

    expect((await repo.list())).toHaveLength(1)
    const sum = (await repo.list())[0]
    expect(sum.title).toBe('新タイトル')
    expect(sum.updatedAt).toBe(5000)
    const loaded = await repo.load('a')
    expect(loaded!.body).toBe('新本文')
    expect(loaded!.title).toBe(sum.title)
    expect(loaded!.updatedAt).toBe(sum.updatedAt)
  })

  it('save writes the body key before the index references it', async () => {
    const repo = new LocalStorageManuscriptRepository(localStorage)
    await repo.save(m('a', 'T', 'B', 1, 1))
    expect(localStorage.getItem(`${BODY_KEY_PREFIX}a`)).not.toBeNull()
    const index = JSON.parse(localStorage.getItem(INDEX_KEY)!) as { id: string }[]
    expect(index.map((e) => e.id)).toContain('a')
  })

  it('self-heals: drops index entries whose body is missing', async () => {
    const repo = new LocalStorageManuscriptRepository(localStorage)
    await repo.save(m('a', 'A', 'bodyA', 1, 1))
    await repo.save(m('b', 'B', 'bodyB', 2, 2))

    // Simulate a crash after body removal but before index update (dangling index entry).
    localStorage.removeItem(`${BODY_KEY_PREFIX}a`)

    const summaries = await repo.list()
    expect(summaries.map((s) => s.id)).toEqual(['b'])
    // Index has been rewritten without the dangling entry.
    const index = JSON.parse(localStorage.getItem(INDEX_KEY)!) as { id: string }[]
    expect(index.map((e) => e.id)).toEqual(['b'])
  })

  it('self-heals: skips orphan bodies not present in the index', async () => {
    const repo = new LocalStorageManuscriptRepository(localStorage)
    await repo.save(m('a', 'A', 'bodyA', 1, 1))

    // Orphan body written directly (e.g. crash after body write, before index update).
    localStorage.setItem(
      `${BODY_KEY_PREFIX}orphan`,
      JSON.stringify({ id: 'orphan', title: 'O', body: 'x', createdAt: 9, updatedAt: 9 }),
    )

    const summaries = await repo.list()
    expect(summaries.map((s) => s.id)).toEqual(['a'])
    // The orphan body is still individually loadable, but never surfaced by list().
    expect(await repo.load('orphan')).not.toBeNull()
  })

  it('treats corrupt index as empty without throwing', async () => {
    localStorage.setItem(INDEX_KEY, '{not json')
    const repo = new LocalStorageManuscriptRepository(localStorage)
    expect(await repo.list()).toEqual([])
  })

  it('treats corrupt body as missing on load', async () => {
    localStorage.setItem(`${BODY_KEY_PREFIX}a`, '{not json')
    const repo = new LocalStorageManuscriptRepository(localStorage)
    expect(await repo.load('a')).toBeNull()
  })
})
