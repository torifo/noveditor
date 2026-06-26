/**
 * Per-manuscript caret/scroll position memory, persisted to localStorage under
 * `noveditor:pos:<id>`. Restored on open/switch so writers return to exactly where they left off.
 *
 * Pure functions (no runes) — the editor owns when to save/restore. All access is wrapped in
 * try/catch so a full or unavailable storage never breaks editing.
 */
export interface CaretPosition {
  scrollTop: number
  selStart: number
  selEnd: number
}

const POS_KEY_PREFIX = 'noveditor:pos:'

export function loadPos(id: string): CaretPosition | null {
  try {
    const raw = localStorage.getItem(POS_KEY_PREFIX + id)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<CaretPosition>
    if (
      typeof parsed.scrollTop !== 'number' ||
      typeof parsed.selStart !== 'number' ||
      typeof parsed.selEnd !== 'number'
    ) {
      return null
    }
    return {
      scrollTop: parsed.scrollTop,
      selStart: parsed.selStart,
      selEnd: parsed.selEnd,
    }
  } catch {
    return null
  }
}

export function savePos(id: string, pos: CaretPosition): void {
  try {
    localStorage.setItem(POS_KEY_PREFIX + id, JSON.stringify(pos))
  } catch {
    /* storage full / unavailable — position memory is best-effort */
  }
}

export function clearPos(id: string): void {
  try {
    localStorage.removeItem(POS_KEY_PREFIX + id)
  } catch {
    /* ignore */
  }
}
