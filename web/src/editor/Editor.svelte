<script lang="ts">
  import { countStats, type DocumentStats } from 'noveditor-core'
  import type { AppState } from '../state/appState.svelte'

  let { app }: { app: AppState } = $props()

  // IME composition guard: while composing we must NOT recompute stats (US-001 AC).
  let composing = $state(false)
  let stats = $state<DocumentStats>(countStats(''))

  let titleEl = $state<HTMLInputElement | null>(null)
  let bodyEl = $state<HTMLTextAreaElement | null>(null)

  // Recompute stats whenever the body changes — but skip while an IME composition is active.
  // When composition ends, `composing` flips to false and this effect reruns, picking up the
  // committed text.
  $effect(() => {
    const text = app.body
    if (composing) return
    stats = countStats(text)
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

  function onCompositionStart() {
    composing = true
  }

  function onCompositionEnd() {
    composing = false
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
        oninput={onEdited}
        oncompositionstart={onCompositionStart}
        oncompositionend={onCompositionEnd}
      ></textarea>
    </div>
  {/if}

  <footer class="statusbar">
    <div class="counts">
      <span class="count-main">
        <strong>{stats.charCount.toLocaleString()}</strong><span class="unit">文字</span>
      </span>
      <span class="count-sub">空白除く {stats.charCountNoWhitespace.toLocaleString()}</span>
      <span class="count-sub">{stats.lineCount.toLocaleString()} 行</span>
    </div>

    <div class="save-area">
      <span class="save-status" data-status={app.saveStatus} aria-live="polite">
        <span class="dot" aria-hidden="true"></span>
        <span class="save-label">{statusLabel[app.saveStatus]}</span>
      </span>
      <button class="save" onclick={() => app.saveNow()} title="保存 (⌘S)">保存</button>
    </div>
  </footer>
</section>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
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
    font-size: 1.12rem;
    line-height: var(--body-line-height);
    letter-spacing: 0.02em;
    color: var(--ink);
  }
  .body::placeholder {
    color: var(--ink-muted);
  }
  /* Inset ring (negative offset) so the keyboard focus indicator never clips at the page edge. */
  .body:focus-visible {
    outline: var(--focus-ring-width) solid var(--accent);
    outline-offset: -2px;
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
    .statusbar {
      padding: var(--space-2) var(--space-4);
    }
    .count-main strong {
      font-size: 1.1rem;
    }
  }
</style>
