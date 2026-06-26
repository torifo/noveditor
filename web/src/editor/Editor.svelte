<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { countStats, type DocumentStats } from 'noveditor-core'
  import type { AppState } from '../state/appState.svelte'
  import type { Settings } from '../state/settings.svelte'
  import { loadPos, savePos } from '../state/positionStore'
  import { centerCaret } from './typewriter'
  import Preview from './Preview.svelte'

  let { app, settings }: { app: AppState; settings: Settings } = $props()

  // IME composition guard: while composing we must NOT recompute stats (US-001 AC).
  let composing = $state(false)
  let stats = $state<DocumentStats>(countStats(''))

  let titleEl = $state<HTMLInputElement | null>(null)
  let bodyEl = $state<HTMLTextAreaElement | null>(null)

  // 編集 ⇄ プレビュー (ruby) view mode — editor-local, resets to edit on reload.
  let mode = $state<'edit' | 'preview'>('edit')

  // 原稿用紙換算: 400字詰め。空行は特別扱いしない（MVP）。
  const pageCount = $derived(Math.ceil(stats.charCount / 400))

  // Session character count: baseline = charCount when the current manuscript was opened
  // (or page load). Switching manuscripts re-baselines; the reset control re-baselines on demand.
  let sessionBaseline = $state(0)
  let baselineId: string | null = null
  const sessionDelta = $derived(stats.charCount - sessionBaseline)
  const sessionLabel = $derived(
    `${sessionDelta >= 0 ? '＋' : '−'}${Math.abs(sessionDelta).toLocaleString()}字`,
  )

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  // Recompute stats whenever the body changes — but skip while an IME composition is active.
  // When composition ends, `composing` flips to false and this effect reruns, picking up the
  // committed text.
  $effect(() => {
    const text = app.body
    if (composing) return
    stats = countStats(text)
  })

  // Re-baseline the session counter when the manuscript changes (untrack body so typing doesn't
  // reset it — only an id change matters).
  $effect(() => {
    const id = app.currentId
    if (id === baselineId) return
    baselineId = id
    sessionBaseline = untrack(() => countStats(app.body).charCount)
  })

  // Move focus when the app requests it (after new / switch). queueMicrotask lets any
  // pending DOM/overlay updates settle first.
  $effect(() => {
    const sig = app.focusSignal
    if (sig === 0) return
    const target = app.focusTarget
    queueMicrotask(() => {
      const el = target === 'title' ? titleEl : bodyEl
      el?.focus()
    })
  })

  // ---- Per-manuscript caret/scroll position memory ----
  // Restore on open/switch. New manuscripts have no saved position, so they naturally start at
  // top (never fighting the focus-on-new behavior). rAF runs after the focus microtask, so the
  // restored caret/scroll is the final word.
  let restoredId: string | null = null
  $effect(() => {
    const id = app.currentId
    if (id === restoredId) return
    restoredId = id
    if (id === null) return
    const pos = loadPos(id)
    if (!pos) return
    const el = bodyEl
    requestAnimationFrame(() => {
      if (!el) return
      try {
        el.setSelectionRange(pos.selStart, pos.selEnd)
      } catch {
        /* indices may exceed shorter bodies — ignore */
      }
      el.scrollTop = pos.scrollTop
    })
  })

  function persistPos(): void {
    const id = app.currentId
    const el = bodyEl
    if (!id || !el) return
    savePos(id, {
      scrollTop: el.scrollTop,
      selStart: el.selectionStart,
      selEnd: el.selectionEnd,
    })
  }

  // Debounced scroll persistence (~300ms).
  let scrollTimer: ReturnType<typeof setTimeout> | null = null
  function onBodyScroll(): void {
    if (scrollTimer) clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => {
      scrollTimer = null
      persistPos()
    }, 300)
  }

  onMount(() => {
    function onVisibility(): void {
      if (document.visibilityState === 'hidden') persistPos()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (scrollTimer) clearTimeout(scrollTimer)
    }
  })

  // Empty-state CTA: shown only while no manuscripts exist and the writer hasn't started.
  let started = $state(false)
  // Plain (non-reactive) tracker so we can detect a >0 -> 0 transition without an effect loop.
  let prevCount = 0
  $effect(() => {
    const count = app.summaries.length
    if (count === 0 && prevCount > 0) started = false
    prevCount = count
  })
  const showEmpty = $derived(app.summaries.length === 0 && !started)

  function beginFirstDraft() {
    started = true
    app.requestFocus('title')
  }

  function onEdited() {
    app.markEdited()
  }

  // Body edits also drive typewriter scrolling (when enabled, and not mid-IME-composition).
  function onBodyInput() {
    app.markEdited()
    if (settings.typewriter && !composing && bodyEl) {
      const el = bodyEl
      requestAnimationFrame(() => centerCaret(el, prefersReducedMotion()))
    }
  }

  function resetSession() {
    sessionBaseline = stats.charCount
  }

  function onCompositionStart() {
    composing = true
  }

  function onCompositionEnd() {
    composing = false
    // Re-center after the committed IME text lands.
    if (settings.typewriter && bodyEl) {
      const el = bodyEl
      requestAnimationFrame(() => centerCaret(el, prefersReducedMotion()))
    }
  }

  const statusLabel: Record<string, string> = {
    idle: '保存済み',
    dirty: '未保存',
    saving: '保存中…',
    saved: '保存済み',
    error: 'エラー',
  }
</script>

<section class="editor">
  {#if showEmpty}
    <div class="empty-state nv-enter">
      <div class="mark" aria-hidden="true">N</div>
      <h2>最初の原稿を始めましょう</h2>
      <p>静かな紙の上で、思いついた一行から書き始められます。</p>
      <button class="cta" onclick={beginFirstDraft}>最初の原稿を始める</button>
    </div>
  {:else}
    {#if !settings.focusMode}
      <div class="toolbar">
        <div class="mode-toggle" role="group" aria-label="表示モード">
          <button
            class:active={mode === 'edit'}
            aria-pressed={mode === 'edit'}
            onclick={() => (mode = 'edit')}>編集</button
          >
          <button
            class:active={mode === 'preview'}
            aria-pressed={mode === 'preview'}
            onclick={() => (mode = 'preview')}>プレビュー</button
          >
        </div>
      </div>
    {/if}

    {#if mode === 'preview'}
      <Preview body={app.body} title={app.title} />
    {:else}
      <div class="page">
        <input
          class="title"
          type="text"
          placeholder="無題"
          aria-label="タイトル"
          bind:this={titleEl}
          bind:value={app.title}
          oninput={onEdited}
          oncompositionstart={onCompositionStart}
          oncompositionend={onCompositionEnd}
        />

        {#if app.errorMessage}
          <p class="error" role="alert">{app.errorMessage}</p>
        {/if}

        <textarea
          class="body"
          placeholder="本文をここに書き始める…"
          aria-label="本文"
          bind:this={bodyEl}
          bind:value={app.body}
          oninput={onBodyInput}
          onscroll={onBodyScroll}
          onblur={persistPos}
          oncompositionstart={onCompositionStart}
          oncompositionend={onCompositionEnd}
        ></textarea>
      </div>
    {/if}
  {/if}

  {#if !settings.focusMode}
    <footer class="statusbar">
      <div class="counts">
        <span class="count-main">
          <strong>{stats.charCount.toLocaleString()}</strong><span class="unit">文字</span>
        </span>
        <span class="count-sub pages" title="原稿用紙換算（400字詰め）">{pageCount.toLocaleString()}枚</span>
        <button
          class="count-session"
          onclick={resetSession}
          title="このセッションで書いた文字数 — クリックでリセット"
        >
          {sessionLabel}
        </button>
        <span class="count-sub hide-narrow">空白除く {stats.charCountNoWhitespace.toLocaleString()}</span>
        <span class="count-sub hide-narrow">{stats.lineCount.toLocaleString()} 行</span>
      </div>

      <div class="save-area">
        <span class="save-status" data-status={app.saveStatus} aria-live="polite">
          <span class="dot" aria-hidden="true"></span>
          <span class="save-label">{statusLabel[app.saveStatus]}</span>
        </span>
        <button class="save" onclick={() => app.saveNow()} title="保存 (⌘S)">保存</button>
      </div>
    </footer>
  {/if}
</section>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  /* ---- Top toolbar: 編集 ⇄ プレビュー toggle ---- */
  .toolbar {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    max-width: calc(var(--reading-measure) + var(--space-6) * 2);
    margin: 0 auto;
    padding: var(--space-3) var(--space-6) 0;
    box-sizing: border-box;
  }
  .mode-toggle {
    display: inline-flex;
    gap: 0.2rem;
    padding: 0.2rem;
    background: var(--surface-sunken);
    border-radius: var(--radius-pill);
  }
  .mode-toggle button {
    padding: var(--space-1) var(--space-4);
    border: none;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--ink-muted);
    font-size: 0.8rem;
    font-weight: 500;
    transition:
      background 0.16s ease,
      color 0.16s ease;
  }
  .mode-toggle button:hover {
    color: var(--ink);
  }
  .mode-toggle button.active {
    background: var(--surface);
    color: var(--accent-strong);
    box-shadow: var(--shadow-sm);
  }

  /* ---- Writing surface: a centered "paper" page ---- */
  .page {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: calc(var(--reading-measure) + var(--space-6) * 2);
    margin: 0 auto;
    padding: var(--space-6) var(--space-6) var(--space-4);
    box-sizing: border-box;
  }

  .title {
    width: 100%;
    border: none;
    background: transparent;
    padding: var(--space-2) 0;
    margin-bottom: var(--space-4);
    font-family: var(--font-serif);
    font-size: 1.7rem;
    font-weight: 600;
    line-height: 1.4;
    color: var(--ink);
    border-bottom: 1px solid transparent;
    transition: border-color 0.18s ease;
  }
  .title::placeholder {
    color: var(--ink-muted);
    font-weight: 400;
  }
  /* Pointer focus: a calm accent underline. Keyboard focus additionally gets the global ring. */
  .title:focus {
    border-bottom-color: var(--accent);
  }

  .body {
    flex: 1;
    min-height: 40vh;
    width: 100%;
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    padding: var(--space-2) 0 var(--space-6);
    font-family: var(--font-serif);
    font-size: var(--editor-font-size, 1.12rem);
    line-height: var(--body-line-height);
    letter-spacing: 0.02em;
    color: var(--ink);
  }
  .body::placeholder {
    color: var(--ink-muted);
  }
  /* The writing surface is a borderless "page" — no focus frame; the caret signals focus. */
  .body:focus,
  .body:focus-visible {
    outline: none;
  }

  .error {
    color: var(--danger);
    font-size: 0.85rem;
    margin-bottom: var(--space-2);
  }

  /* ---- Empty state ---- */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    text-align: center;
    padding: var(--space-6);
  }
  .empty-state .mark {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: var(--radius-md);
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 700;
    font-size: 1.5rem;
    box-shadow: var(--shadow-md);
    margin-bottom: var(--space-2);
  }
  .empty-state h2 {
    font-family: var(--font-serif);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--ink);
  }
  .empty-state p {
    color: var(--ink-soft);
    font-size: 0.95rem;
    max-width: 22rem;
    line-height: 1.7;
  }
  .cta {
    margin-top: var(--space-2);
    padding: var(--space-3) var(--space-5);
    border: none;
    border-radius: var(--radius-pill);
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
    box-shadow: var(--shadow-sm);
    transition:
      background 0.18s ease,
      transform 0.12s ease;
  }
  .cta:hover {
    background: var(--accent-strong);
  }
  .cta:active {
    transform: scale(0.98);
  }

  /* ---- Status bar ---- */
  .statusbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--line);
    background: var(--surface);
  }

  .counts {
    display: flex;
    align-items: baseline;
    gap: var(--space-4);
    min-width: 0;
  }
  .count-main {
    display: inline-flex;
    align-items: baseline;
    gap: 0.2rem;
    color: var(--ink);
  }
  .count-main strong {
    font-size: 1.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
  }
  .count-main .unit {
    font-size: 0.8rem;
    color: var(--ink-soft);
  }
  .count-sub {
    font-size: 0.8rem;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }
  .count-sub.pages {
    color: var(--ink-soft);
    font-weight: 500;
  }
  /* Session-written counter doubles as its own reset button. */
  .count-session {
    padding: 0.1rem var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-pill);
    background: var(--accent-wash);
    color: var(--accent-strong);
    font-size: 0.78rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    transition:
      border-color 0.16s ease,
      background 0.16s ease;
  }
  .count-session:hover {
    border-color: var(--accent);
  }
  .count-session:active {
    transform: scale(0.97);
  }

  .save-area {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .save-status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 0.82rem;
    color: var(--ink-soft);
    min-width: 5.5em;
  }
  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--ink-muted);
    flex-shrink: 0;
    transition: background 0.2s ease;
  }
  .save-status[data-status='idle'] .dot,
  .save-status[data-status='saved'] .dot {
    background: var(--ok);
  }
  .save-status[data-status='dirty'] .dot {
    background: var(--warn);
  }
  .save-status[data-status='saving'] .dot {
    background: var(--accent);
    animation: nv-pulse 1s ease-in-out infinite;
  }
  .save-status[data-status='error'] .dot {
    background: var(--danger);
  }
  .save-status[data-status='error'] .save-label {
    color: var(--danger);
  }

  @keyframes nv-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }

  .save {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink-soft);
    font-size: 0.85rem;
    font-weight: 500;
    transition:
      background 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease,
      transform 0.12s ease;
  }
  .save:hover {
    background: var(--surface-sunken);
    border-color: var(--accent);
    color: var(--ink);
  }
  .save:active {
    transform: scale(0.97);
  }

  @media (max-width: 720px) {
    .page {
      padding: var(--space-4) var(--space-4) var(--space-3);
    }
    .toolbar {
      padding: var(--space-3) var(--space-4) 0;
    }
    .statusbar {
      padding: var(--space-2) var(--space-4);
    }
    .count-main strong {
      font-size: 1.1rem;
    }
    /* Reclaim room for 枚数 + session count on small screens. */
    .hide-narrow {
      display: none;
    }
  }
</style>
