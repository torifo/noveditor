import type { AppState } from '../state/appState.svelte'
import type { Settings } from '../state/settings.svelte'

/**
 * A single invocable action, shared by the ⌘K command palette and the keyboard shortcuts so the
 * labels/behaviour never drift apart. `run` may be async; callers don't await it.
 */
export interface Command {
  id: string
  label: string
  /** Right-aligned hint (usually the keyboard shortcut). */
  hint?: string
  /** Extra search terms (romaji / English) so the palette finds commands by alias. */
  keywords?: string
  /** Hide the command when it isn't currently applicable (e.g. "delete" with nothing open). */
  enabled?: () => boolean
  run: () => void | Promise<void>
}

export interface CommandContext {
  app: AppState
  settings: Settings
  /** Open the help overlay (owned by App.svelte). */
  openHelp: () => void
  /** Show/hide the 小説一覧 sidebar (owned by App.svelte). */
  toggleSidebar: () => void
  /** Open the export overlay for the current 話 (owned by App.svelte). */
  openExport: () => void
}

/** The id of the episode `delta` slots from the current one within the open novel, or null. */
export function adjacentEpisodeId(app: AppState, delta: -1 | 1): string | null {
  const eps = app.episodes
  const cur = app.currentEpisodeId
  if (cur === null || eps.length === 0) return null
  const i = eps.findIndex((e) => e.id === cur)
  if (i < 0) return null
  const j = i + delta
  if (j < 0 || j >= eps.length) return null
  return eps[j].id
}

/** Move to the previous (-1) / next (+1) 話 within the open novel, if any. */
export async function gotoAdjacentEpisode(app: AppState, delta: -1 | 1): Promise<void> {
  const id = adjacentEpisodeId(app, delta)
  if (id !== null) await app.openEpisode(id)
}

/** Build the full command list against the live app/settings. Re-build per palette open. */
export function buildCommands(ctx: CommandContext): Command[] {
  const { app, settings } = ctx
  return [
    {
      id: 'new-episode',
      label: '話を追加',
      hint: '⌘N',
      keywords: 'new episode shinki wa add hanashi',
      run: () => app.createEpisode(),
    },
    {
      id: 'new-novel',
      label: '小説を追加',
      hint: '⌘⇧N',
      keywords: 'new novel shinki shousetsu create',
      run: () => app.createNovel(),
    },
    {
      id: 'save',
      label: '保存',
      hint: '⌘S',
      keywords: 'save hozon',
      enabled: () => app.hasEpisode,
      run: () => app.saveNow(),
    },
    {
      id: 'next-episode',
      label: '次の話へ',
      hint: '⌘⌥↓',
      keywords: 'next episode tsugi',
      enabled: () => adjacentEpisodeId(app, 1) !== null,
      run: () => gotoAdjacentEpisode(app, 1),
    },
    {
      id: 'prev-episode',
      label: '前の話へ',
      hint: '⌘⌥↑',
      keywords: 'previous episode mae',
      enabled: () => adjacentEpisodeId(app, -1) !== null,
      run: () => gotoAdjacentEpisode(app, -1),
    },
    {
      id: 'theme-light',
      label: 'テーマ：紙',
      keywords: 'theme paper light kami',
      run: () => settings.setTheme('light'),
    },
    {
      id: 'theme-sepia',
      label: 'テーマ：セピア',
      keywords: 'theme sepia',
      run: () => settings.setTheme('sepia'),
    },
    {
      id: 'theme-dark',
      label: 'テーマ：夜',
      keywords: 'theme dark night yoru',
      run: () => settings.setTheme('dark'),
    },
    {
      id: 'toggle-sidebar',
      label: '小説一覧の表示／非表示',
      hint: '⌘B',
      keywords: 'sidebar toggle ichiran list hide show',
      run: () => ctx.toggleSidebar(),
    },
    {
      id: 'toggle-focus',
      label: '集中モードの切り替え',
      hint: '⌘\\',
      keywords: 'focus mode shuuchuu zen',
      run: () => settings.toggleFocusMode(),
    },
    {
      id: 'toggle-typewriter',
      label: 'タイプライタースクロールの切り替え',
      keywords: 'typewriter scroll',
      run: () => settings.toggleTypewriter(),
    },
    {
      id: 'export-episode',
      label: 'この話をエクスポート',
      hint: '⌘E',
      keywords: 'export kakuyomu narou alphapolis toukou shuppan 出力 投稿',
      enabled: () => app.currentEpisodeId !== null,
      run: () => ctx.openExport(),
    },
    {
      id: 'delete-episode',
      label: '現在の話を削除',
      keywords: 'delete episode sakujo remove',
      enabled: () => app.currentEpisodeId !== null,
      run: () => {
        const id = app.currentEpisodeId
        if (id !== null) return app.removeEpisode(id)
      },
    },
    {
      id: 'help',
      label: 'ヘルプを開く',
      hint: '?',
      keywords: 'help herupu shortcuts',
      run: () => ctx.openHelp(),
    },
  ]
}

/** Case-insensitive substring filter over label + keywords. Empty query → all enabled commands. */
export function filterCommands(commands: Command[], query: string): Command[] {
  const enabled = commands.filter((c) => (c.enabled ? c.enabled() : true))
  const q = query.trim().toLowerCase()
  if (q === '') return enabled
  return enabled.filter(
    (c) => c.label.toLowerCase().includes(q) || (c.keywords ?? '').toLowerCase().includes(q),
  )
}
