<script lang="ts">
  import { onMount } from 'svelte'
  import { AppState } from './state/appState.svelte'
  import Editor from './editor/Editor.svelte'
  import ManuscriptList from './list/ManuscriptList.svelte'
  import Toast from './ui/Toast.svelte'

  const app = new AppState()

  // Mobile-only overlay state for the sidebar (desktop keeps it persistent via CSS).
  let sidebarOpen = $state(false)

  onMount(() => {
    void app.init()

    // Global keyboard shortcuts: Cmd/Ctrl+S saves, Cmd/Ctrl+N starts a new manuscript.
    // Both block the browser default.
    function onKeydown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        void app.saveNow()
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        void app.createNew()
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

<div class="app">
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
      <span class="word">nov<span class="cap">E</span>ditor</span>
    </h1>
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
      <Editor {app} />
    </main>
  </div>

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
    font-family: 'Avenir Next', 'Futura', 'Century Gothic', 'Segoe UI',
      ui-sans-serif, system-ui, sans-serif;
    font-weight: 600;
    font-size: 1.2rem;
    letter-spacing: 0.005em;
    color: var(--ink);
  }
  .cap {
    color: var(--accent);
    font-weight: 700;
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
