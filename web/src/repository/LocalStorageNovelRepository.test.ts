import { beforeEach, describe, expect, it } from 'vitest'
import { Episode, Novel } from 'noveditor-core'
import {
  EPISODE_KEY_PREFIX,
  LocalStorageNovelRepository,
  NOVELS_INDEX_KEY,
  NOVEL_KEY_PREFIX,
} from './LocalStorageNovelRepository'

const novel = (
  id: string,
  title: string,
  order: string[],
  createdAt: number,
  updatedAt: number,
  synopsis = '',
): Novel => new Novel(id, title, synopsis, order, createdAt, updatedAt)

const episode = (
  id: string,
  novelId: string,
  title: string,
  body: string,
  createdAt: number,
  updatedAt: number,
): Episode => new Episode(id, novelId, title, body, createdAt, updatedAt)

describe('LocalStorageNovelRepository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips novel save -> load -> list -> delete', async () => {
    const repo = new LocalStorageNovelRepository(localStorage)

    expect(await repo.listNovels()).toEqual([])
    expect(await repo.loadNovel('missing')).toBeNull()

    await repo.saveEpisode(episode('e1', 'n1', '第一話', '本文1', 1000, 1000))
    await repo.saveNovel(novel('n1', '連載小説', ['e1'], 1000, 1000, 'あらすじ'))

    const loaded = await repo.loadNovel('n1')
    expect(loaded).not.toBeNull()
    expect(loaded!.title).toBe('連載小説')
    expect(loaded!.synopsis).toBe('あらすじ')
    expect(loaded!.episodeOrder).toEqual(['e1'])

    const summaries = await repo.listNovels()
    expect(summaries).toHaveLength(1)
    expect(summaries[0].id).toBe('n1')
    expect(summaries[0].episodeCount).toBe(1)
    expect(summaries[0].title).toBe('連載小説')

    await repo.deleteNovel('n1')
    expect(await repo.loadNovel('n1')).toBeNull()
    expect(await repo.listNovels()).toEqual([])
    // delete is a no-op when absent
    await expect(repo.deleteNovel('n1')).resolves.toBeUndefined()
  })

  it('lists episodes in episodeOrder, not insertion order', async () => {
    const repo = new LocalStorageNovelRepository(localStorage)
    await repo.saveEpisode(episode('a', 'n1', 'A', 'ba', 1, 1))
    await repo.saveEpisode(episode('b', 'n1', 'B', 'bb', 2, 2))
    await repo.saveEpisode(episode('c', 'n1', 'C', 'bc', 3, 3))
    await repo.saveNovel(novel('n1', 'N', ['c', 'a', 'b'], 1, 3))

    const eps = await repo.listEpisodes('n1')
    expect(eps.map((e) => e.id)).toEqual(['c', 'a', 'b'])
    expect(eps.map((e) => e.title)).toEqual(['C', 'A', 'B'])
  })

  it('listEpisodes returns [] for an unknown novel', async () => {
    const repo = new LocalStorageNovelRepository(localStorage)
    expect(await repo.listEpisodes('nope')).toEqual([])
  })

  it('reorder via saveNovel persists the new episodeOrder', async () => {
    const repo = new LocalStorageNovelRepository(localStorage)
    await repo.saveEpisode(episode('a', 'n1', 'A', '', 1, 1))
    await repo.saveEpisode(episode('b', 'n1', 'B', '', 2, 2))
    await repo.saveNovel(novel('n1', 'N', ['a', 'b'], 1, 2))

    const n = (await repo.loadNovel('n1'))!
    const order = [...n.episodeOrder]
    ;[order[0], order[1]] = [order[1], order[0]]
    await repo.saveNovel(new Novel(n.id, n.title, n.synopsis, order, n.createdAt, 9))

    expect((await repo.loadNovel('n1'))!.episodeOrder).toEqual(['b', 'a'])
    expect((await repo.listEpisodes('n1')).map((e) => e.id)).toEqual(['b', 'a'])
  })

  it('deleteEpisode removes the body and drops it from the parent episodeOrder', async () => {
    const repo = new LocalStorageNovelRepository(localStorage)
    await repo.saveEpisode(episode('a', 'n1', 'A', '', 1, 1))
    await repo.saveEpisode(episode('b', 'n1', 'B', '', 2, 2))
    await repo.saveNovel(novel('n1', 'N', ['a', 'b'], 1, 2))

    await repo.deleteEpisode('a')
    expect(await repo.loadEpisode('a')).toBeNull()
    expect((await repo.loadNovel('n1'))!.episodeOrder).toEqual(['b'])
    expect((await repo.listNovels())[0].episodeCount).toBe(1)
  })

  it('deleteNovel cascades to its episode bodies', async () => {
    const repo = new LocalStorageNovelRepository(localStorage)
    await repo.saveEpisode(episode('a', 'n1', 'A', '', 1, 1))
    await repo.saveEpisode(episode('b', 'n1', 'B', '', 2, 2))
    await repo.saveNovel(novel('n1', 'N', ['a', 'b'], 1, 2))

    await repo.deleteNovel('n1')
    expect(localStorage.getItem(`${EPISODE_KEY_PREFIX}a`)).toBeNull()
    expect(localStorage.getItem(`${EPISODE_KEY_PREFIX}b`)).toBeNull()
    expect(localStorage.getItem(`${NOVEL_KEY_PREFIX}n1`)).toBeNull()
  })

  it('save writes the novel body before the index references it', async () => {
    const repo = new LocalStorageNovelRepository(localStorage)
    await repo.saveNovel(novel('n1', 'N', [], 1, 1))
    expect(localStorage.getItem(`${NOVEL_KEY_PREFIX}n1`)).not.toBeNull()
    const index = JSON.parse(localStorage.getItem(NOVELS_INDEX_KEY)!) as { id: string }[]
    expect(index.map((e) => e.id)).toContain('n1')
  })

  it('self-heals: drops index entries whose novel body is missing', async () => {
    const repo = new LocalStorageNovelRepository(localStorage)
    await repo.saveNovel(novel('n1', 'A', [], 1, 1))
    await repo.saveNovel(novel('n2', 'B', [], 2, 2))

    // Simulate a crash: novel body gone but index still references it.
    localStorage.removeItem(`${NOVEL_KEY_PREFIX}n1`)

    const summaries = await repo.listNovels()
    expect(summaries.map((s) => s.id)).toEqual(['n2'])
    const index = JSON.parse(localStorage.getItem(NOVELS_INDEX_KEY)!) as { id: string }[]
    expect(index.map((e) => e.id)).toEqual(['n2'])
  })

  it('self-heals: drops dangling episode refs from episodeOrder on listEpisodes', async () => {
    const repo = new LocalStorageNovelRepository(localStorage)
    await repo.saveEpisode(episode('a', 'n1', 'A', '', 1, 1))
    await repo.saveNovel(novel('n1', 'N', ['a', 'ghost'], 1, 1))

    const eps = await repo.listEpisodes('n1')
    expect(eps.map((e) => e.id)).toEqual(['a'])
    // Novel order rewritten without the dangling ref.
    expect((await repo.loadNovel('n1'))!.episodeOrder).toEqual(['a'])
  })

  it('listNovels recomputes episodeCount from live episodes', async () => {
    const repo = new LocalStorageNovelRepository(localStorage)
    await repo.saveEpisode(episode('a', 'n1', 'A', '', 1, 1))
    await repo.saveNovel(novel('n1', 'N', ['a', 'ghost'], 1, 1))

    // 'ghost' has no body, so the live count is 1.
    expect((await repo.listNovels())[0].episodeCount).toBe(1)
  })

  it('treats a corrupt novel index as empty without throwing', async () => {
    localStorage.setItem(NOVELS_INDEX_KEY, '{not json')
    const repo = new LocalStorageNovelRepository(localStorage)
    expect(await repo.listNovels()).toEqual([])
  })

  it('treats a corrupt novel body as missing on load', async () => {
    localStorage.setItem(`${NOVEL_KEY_PREFIX}n1`, '{not json')
    const repo = new LocalStorageNovelRepository(localStorage)
    expect(await repo.loadNovel('n1')).toBeNull()
  })
})
