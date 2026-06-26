import { Manuscript } from 'noveditor-core'

/**
 * Mints a brand-new {@link Manuscript}. The web adapter owns id generation and the clock
 * (`core` is pure and holds neither): `id = crypto.randomUUID()`, `createdAt = updatedAt = now`.
 */
export function createManuscript(title = '', body = ''): Manuscript {
  const now = Date.now()
  return new Manuscript(crypto.randomUUID(), title, body, now, now)
}
