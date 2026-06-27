import { describe, it, expect } from 'vitest'
import { sc, MOD, MOD_ICON } from './shortcut'

// The test environment (jsdom) is non-mac, so these assertions exercise the
// Windows / Linux branch — i.e. exactly what those users see.
describe('sc — non-mac (Windows/Linux) shortcut display', () => {
  it('formats a single-modifier shortcut as Ctrl+Key', () => {
    expect(sc('K')).toBe('Ctrl+K')
    expect(sc('S')).toBe('Ctrl+S')
    expect(sc('\\')).toBe('Ctrl+\\')
  })

  it('formats multi-modifier shortcuts in order', () => {
    expect(sc('N', 'shift')).toBe('Ctrl+Shift+N')
    expect(sc('↓', 'alt')).toBe('Ctrl+Alt+↓')
    expect(sc('↑', 'alt')).toBe('Ctrl+Alt+↑')
  })

  it('exposes Ctrl-based labels', () => {
    expect(MOD).toBe('Ctrl')
    expect(MOD_ICON).toBe('⌃')
  })
})
