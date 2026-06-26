<script lang="ts">
  import { countStats, type DocumentStats } from 'noveditor-core'
  import type { AppState } from '../state/appState.svelte'

  let { app }: { app: AppState } = $props()

  // IME composition guard: while composing we must NOT recompute stats (US-001 AC).
  let composing = $state(false)
  let stats = $state<DocumentStats>(countStats(''))

  // Recompute stats whenever the body changes — but skip while an IME composition is active.
  // When composition ends, `composing` flips to false and this effect reruns, picking up the
  // committed text.
  $effect(() => {
    const text = app.body
    if (composing) return
    stats = countStats(text)
  })

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
    idle: '',
    dirty: '未保存',
    saving: '保存中…',
    saved: '保存済み',
    error: 'エラー',
  }
</script>

<section class="editor">
  <div class="toolbar">
    <input
      class="title"
      type="text"
      placeholder="タイトル（無題）"
      bind:value={app.title}
      oninput={onEdited}
      oncompositionstart={onCompositionStart}
      oncompositionend={onCompositionEnd}
    />
    <button class="save" onclick={() => app.saveNow()}>保存</button>
    <span class="status status-{app.saveStatus}">{statusLabel[app.saveStatus]}</span>
  </div>

  {#if app.errorMessage}
    <p class="error" role="alert">{app.errorMessage}</p>
  {/if}

  <textarea
    class="body"
    placeholder="本文をここに入力…"
    bind:value={app.body}
    oninput={onEdited}
    oncompositionstart={onCompositionStart}
    oncompositionend={onCompositionEnd}
  ></textarea>

  <div class="stats">
    <span>文字数: {stats.charCount}</span>
    <span>空白除く: {stats.charCountNoWhitespace}</span>
    <span>行数: {stats.lineCount}</span>
  </div>
</section>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
    padding: 1rem;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .title {
    flex: 1;
    font-size: 1.1rem;
    padding: 0.4rem 0.6rem;
  }
  .body {
    flex: 1;
    min-height: 50vh;
    resize: vertical;
    font-size: 1rem;
    line-height: 1.7;
    padding: 0.8rem;
    font-family: inherit;
  }
  .stats {
    display: flex;
    gap: 1rem;
    font-size: 0.85rem;
    color: #555;
  }
  .status {
    font-size: 0.8rem;
    color: #888;
    min-width: 4em;
  }
  .status-error {
    color: #c00;
  }
  .status-saved {
    color: #2a7;
  }
  .error {
    color: #c00;
    font-size: 0.85rem;
    margin: 0;
  }
</style>
