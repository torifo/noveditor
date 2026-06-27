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

  describe('foreNote / afterNote (お知らせ・あとがき)', () => {
    it('round-trips an episode foreNote/afterNote through save -> load', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      await repo.saveEpisode(
        new Episode('e1', 'n1', '第一話', '本文', 1000, 1000, 'お知らせ本文', 'あとがき本文'),
      )

      const loaded = await repo.loadEpisode('e1')
      expect(loaded).not.toBeNull()
      expect(loaded!.foreNote).toBe('お知らせ本文')
      expect(loaded!.afterNote).toBe('あとがき本文')
    })

    it('round-trips a novel foreNote/afterNote through save -> load', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      await repo.saveNovel(
        new Novel('n1', '連載小説', 'あらすじ', [], 1000, 1000, 'お知らせ本文', 'あとがき本文'),
      )

      const loaded = await repo.loadNovel('n1')
      expect(loaded).not.toBeNull()
      expect(loaded!.foreNote).toBe('お知らせ本文')
      expect(loaded!.afterNote).toBe('あとがき本文')
    })

    it('episodes created via the 6-arg helper default foreNote/afterNote to empty strings', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      await repo.saveEpisode(episode('e1', 'n1', '第一話', '本文', 1000, 1000))

      const loaded = await repo.loadEpisode('e1')
      expect(loaded!.foreNote).toBe('')
      expect(loaded!.afterNote).toBe('')
    })

    it('novels created via the 6-arg helper default foreNote/afterNote to empty strings', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      await repo.saveNovel(novel('n1', '連載小説', [], 1000, 1000))

      const loaded = await repo.loadNovel('n1')
      expect(loaded!.foreNote).toBe('')
      expect(loaded!.afterNote).toBe('')
    })

    it('migrates a legacy episode record that lacks foreNote/afterNote (defaults to empty)', async () => {
      // A record written before お知らせ/あとがき existed: no foreNote/afterNote keys.
      const legacy = {
        id: 'e1',
        novelId: 'n1',
        title: '第一話',
        body: '本文',
        createdAt: 1000,
        updatedAt: 1000,
      }
      localStorage.setItem(`${EPISODE_KEY_PREFIX}e1`, JSON.stringify(legacy))

      const repo = new LocalStorageNovelRepository(localStorage)
      const loaded = await repo.loadEpisode('e1')
      expect(loaded).not.toBeNull()
      expect(loaded!.title).toBe('第一話')
      expect(loaded!.foreNote).toBe('')
      expect(loaded!.afterNote).toBe('')
    })

    it('migrates a legacy novel record that lacks foreNote/afterNote (defaults to empty)', async () => {
      // A novel body written before お知らせ/あとがき existed: no foreNote/afterNote keys.
      const legacy = {
        id: 'n1',
        title: '連載小説',
        synopsis: 'あらすじ',
        episodeOrder: [],
        createdAt: 1000,
        updatedAt: 1000,
      }
      localStorage.setItem(`${NOVEL_KEY_PREFIX}n1`, JSON.stringify(legacy))
      // Ensure the index references it so listNovels/loadNovel work as for a real record.
      localStorage.setItem(
        NOVELS_INDEX_KEY,
        JSON.stringify([{ id: 'n1', title: '連載小説', episodeCount: 0, updatedAt: 1000 }]),
      )

      const repo = new LocalStorageNovelRepository(localStorage)
      const loaded = await repo.loadNovel('n1')
      expect(loaded).not.toBeNull()
      expect(loaded!.title).toBe('連載小説')
      expect(loaded!.foreNote).toBe('')
      expect(loaded!.afterNote).toBe('')

      const summaries = await repo.listNovels()
      expect(summaries.map((s) => s.id)).toEqual(['n1'])
    })
  })

  describe('searchEpisodes', () => {
    it('returns [] for a blank query', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      await repo.saveEpisode(episode('e1', 'n1', 'タイトル', '本文', 1, 1))
      await repo.saveNovel(novel('n1', '小説', ['e1'], 1, 1))

      expect(await repo.searchEpisodes('')).toEqual([])
      expect(await repo.searchEpisodes('   ')).toEqual([])
    })

    it('matches on body and returns matchedIn: body with a contextual snippet', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      await repo.saveEpisode(episode('e1', 'n1', 'タイトル', '吾輩は猫である。名前はまだ無い。', 1, 1))
      await repo.saveNovel(novel('n1', '小説', ['e1'], 1, 1))

      const hits = await repo.searchEpisodes('名前')
      expect(hits).toHaveLength(1)
      expect(hits[0].matchedIn).toBe('body')
      expect(hits[0].episodeId).toBe('e1')
      expect(hits[0].novelId).toBe('n1')
      expect(hits[0].novelTitle).toBe('小説')
      expect(hits[0].episodeTitle).toBe('タイトル')
      expect(hits[0].snippet).toContain('名前')
    })

    it('matches on episode title and uses the title as the snippet', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      await repo.saveEpisode(episode('e1', 'n1', '出会いの章', '関係ない本文', 1, 1))
      await repo.saveNovel(novel('n1', '小説', ['e1'], 1, 1))

      const hits = await repo.searchEpisodes('出会い')
      expect(hits).toHaveLength(1)
      expect(hits[0].matchedIn).toBe('title')
      expect(hits[0].snippet).toBe('出会いの章')
    })

    it('matches on novel title for all of its episodes', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      await repo.saveEpisode(episode('e1', 'n1', 'A', 'aaa', 1, 1))
      await repo.saveEpisode(episode('e2', 'n1', 'B', 'bbb', 2, 2))
      await repo.saveNovel(novel('n1', '冒険譚', ['e1', 'e2'], 1, 2))

      const hits = await repo.searchEpisodes('冒険')
      expect(hits).toHaveLength(2)
      expect(hits.every((h) => h.matchedIn === 'novel')).toBe(true)
      expect(hits.every((h) => h.snippet === '冒険譚')).toBe(true)
    })

    it('is case-insensitive for ASCII text', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      await repo.saveEpisode(episode('e1', 'n1', 'Chapter', 'Hello world', 1, 1))
      await repo.saveNovel(novel('n1', 'Story', ['e1'], 1, 1))

      const hits = await repo.searchEpisodes('hello')
      expect(hits).toHaveLength(1)
      expect(hits[0].matchedIn).toBe('body')
      expect(hits[0].snippet.toLowerCase()).toContain('hello')
    })

    it('matches Japanese substrings inside the body', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      await repo.saveEpisode(episode('e1', 'n1', '序章', '夜明けの街で', 1, 1))
      await repo.saveNovel(novel('n1', '小説', ['e1'], 1, 1))

      const hits = await repo.searchEpisodes('明け')
      expect(hits).toHaveLength(1)
      expect(hits[0].matchedIn).toBe('body')
    })

    it('orders title matches before body matches for the same query', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      // e1: query appears in the episode title (priority 'title')
      await repo.saveEpisode(episode('e1', 'n1', '光の話', '無関係', 5, 5))
      // e2: query appears only in the body (priority 'body'), more recently updated
      await repo.saveEpisode(episode('e2', 'n1', '影の話', '遠くに光が見えた', 9, 9))
      await repo.saveNovel(novel('n1', '物語', ['e1', 'e2'], 1, 9))

      const hits = await repo.searchEpisodes('光')
      expect(hits.map((h) => h.episodeId)).toEqual(['e1', 'e2'])
      expect(hits[0].matchedIn).toBe('title')
      expect(hits[1].matchedIn).toBe('body')
    })

    it('sorts by updatedAt descending within the same priority', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      await repo.saveEpisode(episode('old', 'n1', 'A', '魔法の杖', 1, 1))
      await repo.saveEpisode(episode('new', 'n1', 'B', '魔法の本', 2, 5))
      await repo.saveNovel(novel('n1', '小説', ['old', 'new'], 1, 5))

      const hits = await repo.searchEpisodes('魔法')
      expect(hits.map((h) => h.episodeId)).toEqual(['new', 'old'])
    })

    it('returns [] when nothing matches', async () => {
      const repo = new LocalStorageNovelRepository(localStorage)
      await repo.saveEpisode(episode('e1', 'n1', 'タイトル', '本文', 1, 1))
      await repo.saveNovel(novel('n1', '小説', ['e1'], 1, 1))

      expect(await repo.searchEpisodes('存在しない語')).toEqual([])
    })
  })
})
