// Platform-aware keyboard-shortcut *display*. The keydown handler (App.svelte) already
// accepts Cmd OR Ctrl, so this governs only how shortcuts are shown: macOS uses the
// concatenated symbols (⌘⇧N), Windows / Linux the "Ctrl+Shift+N" idiom.
const isMac =
  typeof navigator !== 'undefined' &&
  /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent)

/** Modifier label for prose: "⌘" on macOS, "Ctrl" elsewhere. */
export const MOD = isMac ? '⌘' : 'Ctrl'

/** Compact single-glyph modifier icon for small decorative badges. */
export const MOD_ICON = isMac ? '⌘' : '⌃'

type Extra = 'shift' | 'alt'
const SYM_MAC: Record<'mod' | Extra, string> = { mod: '⌘', shift: '⇧', alt: '⌥' }
const SYM_PC: Record<'mod' | Extra, string> = { mod: 'Ctrl', shift: 'Shift', alt: 'Alt' }

/**
 * Format a Cmd/Ctrl-based shortcut for the current platform.
 *   sc('K')           → "⌘K"   / "Ctrl+K"
 *   sc('N', 'shift')  → "⌘⇧N"  / "Ctrl+Shift+N"
 *   sc('↓', 'alt')    → "⌘⌥↓"  / "Ctrl+Alt+↓"
 */
export function sc(key: string, ...extras: Extra[]): string {
  const sym = isMac ? SYM_MAC : SYM_PC
  const mods = (['mod', ...extras] as ('mod' | Extra)[]).map((m) => sym[m])
  return isMac ? mods.join('') + key : [...mods, key].join('+')
}
