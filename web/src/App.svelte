<script lang="ts">
  import { onMount } from 'svelte'
  import { AppState } from './state/appState.svelte'
  import type { Settings } from './state/settings.svelte'
  import Editor from './editor/Editor.svelte'
  import NovelList from './list/NovelList.svelte'
  import SettingsPanel from './ui/SettingsPanel.svelte'
  import Toast from './ui/Toast.svelte'
  import CommandPalette from './ui/CommandPalette.svelte'
  import HelpOverlay from './ui/HelpOverlay.svelte'
  import Welcome from './ui/Welcome.svelte'
  import { gotoAdjacentEpisode } from './ui/commands'

  // First-run greeting — shown once, then remembered.
  const ONBOARDED_KEY = 'noveditor:onboarded:v1'
  let showWelcome = $state(false)

  function dismissWelcome() {
    showWelcome = false
    try {
      localStorage.setItem(ONBOARDED_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  let { settings }: { settings: Settings } = $props()

  const app = new AppState()

  // Collapsible sidebar. Below WIDE_QUERY it folds into an off-canvas overlay; above it, it's an
  // inline panel that can still be folded to give the writing surface the full width. `sidebarOpen`
  // is seeded from the viewport at mount (open when wide, folded when narrow) and re-seeded whenever
  // the breakpoint is crossed, so narrowing the window auto-folds it.
  const WIDE_QUERY = '(min-width: 1024px)'
  let isWide = $state(true)
  let sidebarOpen = $state(true)

  // ⌘K command palette + ? help overlay.
  let paletteOpen = $state(false)
  let helpOpen = $state(false)

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen
  }

  /** True while focus is in a text field — so bare `?` types a character instead of opening help. */
  function isTypingTarget(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null
    if (t === null) return false
    return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable
  }

  onMount(() => {
    void app.init()

    // Show the first-run greeting once.
    try {
      showWelcome = localStorage.getItem(ONBOARDED_KEY) === null
    } catch {
      showWelcome = false
    }

    // Seed + track the sidebar against the viewport: open when wide, folded when narrow, and
    // re-seed on every breakpoint cross so the editor is prioritized as the window shrinks.
    const mq = window.matchMedia(WIDE_QUERY)
    isWide = mq.matches
    sidebarOpen = mq.matches
    const onBreakpoint = (e: MediaQueryListEvent) => {
      isWide = e.matches
      sidebarOpen = e.matches
    }
    mq.addEventListener('change', onBreakpoint)

    // Global keyboard shortcuts. Overlays (palette/help) own their own Esc/outside-click dismissal.
    //   ⌘K  command palette (toggle)     ?    help (when not typing, no overlay open)
    //   ⌘S  save                         ⌘N   new 話        ⌘⇧N  new 小説
    //   ⌘\  集中モード                    ⌘⌥↑/⌘⌥↓  前の話 / 次の話
    //   Esc exits 集中モード (when no overlay is open).
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && settings.focusMode && !paletteOpen && !helpOpen) {
        settings.exitFocusMode()
        return
      }

      // Bare ? → help. Ignored while typing or when an overlay is already open (it handles its own keys).
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (isTypingTarget(e) || paletteOpen || helpOpen) return
        e.preventDefault()
        helpOpen = true
        return
      }

      if (!(e.metaKey || e.ctrlKey)) return
      const k = e.key.toLowerCase()

      // ⌘K toggles the palette (works everywhere, even while typing).
      if (k === 'k' && !e.altKey) {
        e.preventDefault()
        paletteOpen = !paletteOpen
        if (paletteOpen) helpOpen = false
        return
      }

      // ⌘⌥↑ / ⌘⌥↓ — move between 話 within the open novel.
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        void gotoAdjacentEpisode(app, e.key === 'ArrowDown' ? 1 : -1)
        return
      }
      if (e.altKey) return

      if (k === 's') {
        e.preventDefault()
        void app.saveNow()
      } else if (k === 'n' && e.shiftKey) {
        e.preventDefault()
        void app.createNovel()
      } else if (k === 'n') {
        e.preventDefault()
        void app.createEpisode()
      } else if (k === 'b') {
        e.preventDefault()
        toggleSidebar()
      } else if (e.key === '\\') {
        e.preventDefault()
        settings.toggleFocusMode()
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => {
      window.removeEventListener('keydown', onKeydown)
      mq.removeEventListener('change', onBreakpoint)
    }
  })

  // After navigating, fold the sidebar only when narrow (on wide it stays open for quick switching).
  function closeSidebar() {
    if (!isWide) sidebarOpen = false
  }
</script>

<div class="app" class:focus-mode={settings.focusMode} class:sidebar-open={sidebarOpen}>
  <header class="app-header nv-enter" style="--nv-delay: 0ms">
    <button
      class="nav-toggle"
      aria-label={sidebarOpen ? '小説一覧を閉じる' : '小説一覧を開く'}
      aria-expanded={sidebarOpen}
      title="小説一覧の表示／非表示 (⌘B)"
      onclick={toggleSidebar}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M4 6h16M4 12h16M4 18h16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <h1 class="wordmark">
      <img class="mark" src="/favicon.svg" alt="" width="28" height="28" />
      <span class="word">ノヴェディタ</span>
    </h1>

    <div class="header-tools">
      <button
        class="tool-btn"
        aria-label="集中モード"
        aria-pressed={settings.focusMode}
        title="集中モード (⌘\)"
        onclick={() => settings.toggleFocusMode()}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <button
        class="tool-btn"
        aria-label="ヘルプ"
        title="ヘルプ (?)"
        onclick={() => (helpOpen = true)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" />
          <path
            d="M9.4 9.2a2.6 2.6 0 1 1 3.7 2.4c-.8.4-1.1 1-1.1 1.8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
          <circle cx="12" cy="16.6" r="0.9" fill="currentColor" />
        </svg>
      </button>
      <SettingsPanel {settings} />
    </div>
  </header>

  <div class="layout">
    <div class="sidebar nv-enter" style="--nv-delay: 60ms">
      <NovelList {app} onNavigate={closeSidebar} />
    </div>

    <main class="main nv-enter" style="--nv-delay: 120ms">
      <Editor {app} {settings} />
    </main>
  </div>

  {#if settings.focusMode}
    <button class="focus-exit" title="集中モードを終了 (Esc)" onclick={() => settings.exitFocusMode()}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d="M9 5 5 9m0-4 4 4M15 5l4 4m0-4-4 4M9 19l-4-4m0 4 4-4M15 19l4-4m0 4-4-4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
      </svg>
      <span>集中モードを終了</span>
    </button>
  {/if}

  <Toast {app} />

  {#if paletteOpen}
    <CommandPalette
      {app}
      {settings}
      {toggleSidebar}
      onClose={() => (paletteOpen = false)}
      openHelp={() => {
        paletteOpen = false
        helpOpen = true
      }}
    />
  {/if}

  {#if helpOpen}
    <HelpOverlay onClose={() => (helpOpen = false)} />
  {/if}

  {#if showWelcome}
    <Welcome onClose={dismissWelcome} />
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .app-header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: var(--header-h);
    padding: 0 var(--space-4);
    background: var(--surface);
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    z-index: 30;
  }

  .wordmark {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: 1rem;
    font-weight: 400;
    user-select: none;
  }
  .mark {
    width: 1.75rem;
    height: 1.75rem;
    flex-shrink: 0;
    display: block;
    /* favicon.svg already carries its own rounded corners + soft shadow */
  }
  .word {
    font-family: 'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif;
    font-weight: 600;
    font-size: 1.25rem;
    letter-spacing: 0.08em;
    color: var(--ink);
  }

  /* Sidebar toggle — available at every width so the editor can always take the full canvas. */
  .nav-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink-soft);
    flex-shrink: 0;
  }
  .nav-toggle:hover {
    background: var(--surface-sunken);
    color: var(--ink);
  }

  /* Right-aligned header controls: 集中モード toggle + 設定 gear. */
  .header-tools {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .tool-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink-soft);
    transition:
      background 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;
  }
  .tool-btn:hover {
    background: var(--surface-sunken);
    color: var(--ink);
  }
  .tool-btn[aria-pressed='true'] {
    border-color: var(--accent);
    color: var(--accent-strong);
    background: var(--accent-wash);
  }

  /* ---- 集中モード (focus mode): hide all chrome, leave only the paper ---- */
  .app.focus-mode .app-header,
  .app.focus-mode .sidebar {
    display: none;
  }

  /* Faint floating exit affordance, bottom-right. */
  .focus-exit {
    position: fixed;
    right: var(--space-5);
    bottom: var(--space-5);
    z-index: 45;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--ink-muted);
    font-size: 0.78rem;
    box-shadow: var(--shadow-md);
    opacity: 0.45;
    transition:
      opacity 0.2s ease,
      color 0.2s ease;
  }
  .focus-exit:hover,
  .focus-exit:focus-visible {
    opacity: 1;
    color: var(--ink);
  }

  .layout {
    display: flex;
    align-items: stretch;
    flex: 1;
    min-height: 0;
  }

  .sidebar {
    width: 16rem;
    flex-shrink: 0;
    border-right: 1px solid var(--line);
    background: var(--surface);
    overflow-y: auto;
  }

  /*
   * The sidebar is an INLINE panel that pushes the editor at EVERY width — it never overlaps or
   * hides the writing surface. Folding collapses it to zero width so the editor takes the whole
   * canvas. (Below WIDE_QUERY it simply defaults to folded; the editor is always prioritized.)
   */
  .sidebar {
    transition:
      width 0.22s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.18s ease;
  }
  .app:not(.sidebar-open) .sidebar {
    width: 0;
    opacity: 0;
    overflow: hidden;
    border-right-color: transparent;
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
  }

  /* Staggered entrance honoring per-element delay. */
  .nv-enter {
    animation-delay: var(--nv-delay, 0ms);
  }

</style>
