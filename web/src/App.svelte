<script lang="ts">
  import { onMount } from 'svelte'
  import { AppState } from './state/appState.svelte'
  import type { Settings } from './state/settings.svelte'
  import Editor from './editor/Editor.svelte'
  import ManuscriptList from './list/ManuscriptList.svelte'
  import SettingsPanel from './ui/SettingsPanel.svelte'
  import Toast from './ui/Toast.svelte'

  let { settings }: { settings: Settings } = $props()

  const app = new AppState()

  // Mobile-only overlay state for the sidebar (desktop keeps it persistent via CSS).
  let sidebarOpen = $state(false)

  onMount(() => {
    void app.init()

    // Global keyboard shortcuts:
    //   Cmd/Ctrl+S  → save,  Cmd/Ctrl+N → new manuscript,  Cmd/Ctrl+\ → toggle 集中モード.
    //   Esc (when in focus mode) exits it. All block the browser default where relevant.
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && settings.focusMode) {
        settings.exitFocusMode()
        return
      }
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        void app.saveNow()
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        void app.createNew()
      } else if (e.key === '\\') {
        e.preventDefault()
        settings.toggleFocusMode()
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })

  // After navigating on mobile, fold the overlay away so the editor is visible.
  function closeSidebar() {
    sidebarOpen = false
  }
</script>

<div class="app" class:focus-mode={settings.focusMode}>
  <header class="app-header nv-enter" style="--nv-delay: 0ms">
    <button
      class="nav-toggle"
      aria-label={sidebarOpen ? '原稿一覧を閉じる' : '原稿一覧を開く'}
      aria-expanded={sidebarOpen}
      onclick={() => (sidebarOpen = !sidebarOpen)}
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
      <SettingsPanel {settings} />
    </div>
  </header>

  <div class="layout">
    {#if sidebarOpen}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="scrim" onclick={closeSidebar}></div>
    {/if}

    <div class="sidebar nv-enter" class:open={sidebarOpen} style="--nv-delay: 60ms">
      <ManuscriptList {app} onNavigate={closeSidebar} />
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

  .nav-toggle {
    display: none;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink-soft);
  }
  .nav-toggle:hover {
    background: var(--surface-sunken);
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

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
  }

  .scrim {
    display: none;
  }

  /* Staggered entrance honoring per-element delay. */
  .nv-enter {
    animation-delay: var(--nv-delay, 0ms);
  }

  /* ---- Responsive: collapse the sidebar into an overlay on narrow screens ---- */
  @media (max-width: 720px) {
    .nav-toggle {
      display: inline-flex;
    }
    .sidebar {
      position: fixed;
      top: var(--header-h);
      left: 0;
      bottom: 0;
      z-index: 25;
      width: min(80vw, 18rem);
      transform: translateX(-102%);
      transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
      box-shadow: var(--shadow-lg);
    }
    .sidebar.open {
      transform: translateX(0);
    }
    .scrim {
      display: block;
      position: fixed;
      inset: var(--header-h) 0 0 0;
      z-index: 20;
      background: rgba(35, 32, 43, 0.28);
      animation: nv-fade-up 0.2s ease both;
    }
  }
</style>
