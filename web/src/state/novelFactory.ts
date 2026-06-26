import { Episode, Novel } from 'noveditor-core'

/**
 * Factories for the 小説(Novel) → 話(Episode) model. The web adapter owns id generation and the
 * clock (`core` is pure): `id = crypto.randomUUID()`, `createdAt = updatedAt = now`.
 */
export function newId(): string {
  return crypto.randomUUID()
}

export function createEpisode(novelId: string, title = '', body = ''): Episode {
  const now = Date.now()
  return new Episode(newId(), novelId, title, body, now, now)
}

export function createNovel(title = '', synopsis = '', episodeOrder: string[] = []): Novel {
  const now = Date.now()
  return new Novel(newId(), title, synopsis, episodeOrder, now, now)
}
