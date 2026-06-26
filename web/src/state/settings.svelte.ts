/**
 * User writing preferences (Svelte 5 runes), persisted to localStorage and applied to the
 * document root as `data-theme` + CSS custom properties so the whole app reacts via app.css.
 *
 * Persisted: theme, editor font-size, reading max-width, typewriter scrolling.
 * Session-only (never persisted): 集中モード (focus mode).
 *
 * The constructor applies the saved values immediately, so creating the instance in `main.ts`
 * *before* mounting avoids a theme flash (FOUC).
 */
export type Theme = 'light' | 'dark' | 'sepia'

const THEME_KEY = 'noveditor:theme'
const FONT_SIZE_KEY = 'noveditor:fontSize'
const LINE_WIDTH_KEY = 'noveditor:lineWidth'
const TYPEWRITER_KEY = 'noveditor:typewriter'

// Bounds (kept in one place so the UI sliders and clamping agree).
export const FONT_SIZE_MIN = 15
export const FONT_SIZE_MAX = 22
export const FONT_SIZE_DEFAULT = 18

export const LINE_WIDTH_MIN = 34
export const LINE_WIDTH_MAX = 48
export const LINE_WIDTH_DEFAULT = 40

const THEMES: readonly Theme[] = ['light', 'dark', 'sepia']

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

export class Settings {
  theme = $state<Theme>('light')
  /** Editor body font size, in px. */
  fontSize = $state(FONT_SIZE_DEFAULT)
  /** Reading column max-width, in rem. */
  lineWidth = $state(LINE_WIDTH_DEFAULT)
  /** Typewriter (caret-centering) scrolling. Opinionated default: OFF. */
  typewriter = $state(false)

  /** 集中モード — session only, not persisted. */
  focusMode = $state(false)

  constructor() {
    try {
      const t = localStorage.getItem(THEME_KEY)
      if (t === 'light' || t === 'dark' || t === 'sepia') this.theme = t
    } catch {
      /* ignore */
    }
    this.fontSize = clamp(
      readNumber(FONT_SIZE_KEY, FONT_SIZE_DEFAULT),
      FONT_SIZE_MIN,
      FONT_SIZE_MAX,
    )
    this.lineWidth = clamp(
      readNumber(LINE_WIDTH_KEY, LINE_WIDTH_DEFAULT),
      LINE_WIDTH_MIN,
      LINE_WIDTH_MAX,
    )
    try {
      this.typewriter = localStorage.getItem(TYPEWRITER_KEY) === '1'
    } catch {
      /* ignore */
    }
    this.applyAll()
  }

  private root(): HTMLElement | null {
    return typeof document !== 'undefined' ? document.documentElement : null
  }

  /** Push every value to the DOM (called once at startup). */
  private applyAll(): void {
    this.applyTheme()
    this.applyFontSize()
    this.applyLineWidth()
  }

  private applyTheme(): void {
    this.root()?.setAttribute('data-theme', this.theme)
  }

  private applyFontSize(): void {
    this.root()?.style.setProperty('--editor-font-size', `${this.fontSize}px`)
  }

  private applyLineWidth(): void {
    this.root()?.style.setProperty('--reading-measure', `${this.lineWidth}rem`)
  }

  setTheme(theme: Theme): void {
    if (!THEMES.includes(theme)) return
    this.theme = theme
    this.applyTheme()
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }

  setFontSize(px: number): void {
    this.fontSize = clamp(Math.round(px), FONT_SIZE_MIN, FONT_SIZE_MAX)
    this.applyFontSize()
    try {
      localStorage.setItem(FONT_SIZE_KEY, String(this.fontSize))
    } catch {
      /* ignore */
    }
  }

  setLineWidth(rem: number): void {
    this.lineWidth = clamp(Math.round(rem), LINE_WIDTH_MIN, LINE_WIDTH_MAX)
    this.applyLineWidth()
    try {
      localStorage.setItem(LINE_WIDTH_KEY, String(this.lineWidth))
    } catch {
      /* ignore */
    }
  }

  setTypewriter(on: boolean): void {
    this.typewriter = on
    try {
      localStorage.setItem(TYPEWRITER_KEY, on ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  toggleTypewriter(): void {
    this.setTypewriter(!this.typewriter)
  }

  toggleFocusMode(): void {
    this.focusMode = !this.focusMode
  }

  exitFocusMode(): void {
    this.focusMode = false
  }
}
