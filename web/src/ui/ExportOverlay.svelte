<script lang="ts">
  import type { AppState } from '../state/appState.svelte'
  import { EXPORT_TARGETS, exportTarget, type ExportTargetId } from '../export/profiles'
  import { buildEpisodeExport } from '../export/buildExport'

  let { app, onClose }: { app: AppState; onClose: () => void } = $props()

  let cardEl = $state<HTMLDivElement | null>(null)
  let closeEl = $state<HTMLButtonElement | null>(null)

  // Read-only textarea refs — used as a clipboard fallback (select the text) when copy fails.
  let foreEl = $state<HTMLTextAreaElement | null>(null)
  let bodyEl = $state<HTMLTextAreaElement | null>(null)
  let afterEl = $state<HTMLTextAreaElement | null>(null)

  let targetId = $state<ExportTargetId>('kakuyomu')
  const target = $derived(exportTarget(targetId))

  // The whole conversion is pure; recomputed whenever the target or the episode text changes.
  const result = $derived(
    buildEpisodeExport(target, {
      novelForeNote: app.novelForeNote,
      episodeForeNote: app.foreNote,
      body: app.body,
      episodeAfterNote: app.afterNote,
      novelAfterNote: app.novelAfterNote,
    }),
  )

  // Which section most recently confirmed a copy (swaps its button label for ~1.5s).
  let copiedKey = $state<string | null>(null)
  let copyTimer: ReturnType<typeof setTimeout> | undefined

  async function copy(key: string, text: string, el: HTMLTextAreaElement | null) {
    try {
      await navigator.clipboard.writeText(text)
      copiedKey = key
      if (copyTimer) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => {
        copiedKey = null
      }, 1500)
    } catch {
      // Fallback: select the text so the writer can copy manually with ⌘C / Ctrl+C.
      if (el) {
        el.focus()
        el.select()
      }
    }
  }

  function download() {
    const name = `${app.title.trim() || '無題'}.txt`
    const blob = new Blob([result.body], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // Escape closes; pointerdown outside the card closes (capture phase, like the other overlays).
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    }
  }
  function onPointerDown(e: PointerEvent) {
    if (cardEl && !cardEl.contains(e.target as Node)) onClose()
  }

  $effect(() => {
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeydown, true)
    // Move focus into the dialog for keyboard users.
    queueMicrotask(() => closeEl?.focus())
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeydown, true)
      if (copyTimer) clearTimeout(copyTimer)
    }
  })
</script>

<div class="backdrop">
  <div
    class="card"
    bind:this={cardEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby="export-title"
  >
    <header class="head">
      <h2 class="title" id="export-title">エクスポート</h2>
      <button class="close" bind:this={closeEl} aria-label="エクスポートを閉じる" onclick={onClose}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </header>

    <div class="body">
      {#if !app.hasEpisode}
        <p class="empty">エクスポートする話を開いてください。</p>
      {:else}
        <section class="sect">
          <div class="seg" role="group" aria-label="投稿サイト">
            {#each EXPORT_TARGETS as t (t.id)}
              <button
                class="seg-btn"
                class:active={targetId === t.id}
                aria-pressed={targetId === t.id}
                onclick={() => (targetId = t.id)}
              >
                {t.label}
              </button>
            {/each}
          </div>
          <p class="hint">{target.hint}</p>
        </section>

        {#if result.foreNote}
          <section class="sect">
            <div class="bhead">
              <h3 class="blabel">前書き（お知らせ）</h3>
              <div class="actions">
                <button
                  class="act"
                  class:done={copiedKey === 'fore'}
                  onclick={() => copy('fore', result.foreNote, foreEl)}
                >
                  {copiedKey === 'fore' ? '✓ コピーしました' : 'コピー'}
                </button>
              </div>
            </div>
            <textarea class="out note" aria-label="前書き（お知らせ）の書き出し" bind:this={foreEl} readonly rows="3" value={result.foreNote}
            ></textarea>
          </section>
        {/if}

        <section class="sect">
          <div class="bhead">
            <h3 class="blabel">本文</h3>
            <div class="actions">
              <button
                class="act"
                class:done={copiedKey === 'body'}
                onclick={() => copy('body', result.body, bodyEl)}
              >
                {copiedKey === 'body' ? '✓ コピーしました' : 'コピー'}
              </button>
              <button class="act" onclick={download}>.txt を保存</button>
            </div>
          </div>
          <textarea class="out body-out" aria-label="本文の書き出し" bind:this={bodyEl} readonly rows="10" value={result.body}
          ></textarea>
        </section>

        {#if result.afterNote}
          <section class="sect">
            <div class="bhead">
              <h3 class="blabel">後書き（あとがき）</h3>
              <div class="actions">
                <button
                  class="act"
                  class:done={copiedKey === 'after'}
                  onclick={() => copy('after', result.afterNote, afterEl)}
                >
                  {copiedKey === 'after' ? '✓ コピーしました' : 'コピー'}
                </button>
              </div>
            </div>
            <textarea class="out note" aria-label="後書き（あとがき）の書き出し" bind:this={afterEl} readonly rows="3" value={result.afterNote}
            ></textarea>
          </section>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-5);
    background: rgba(35, 32, 43, 0.28);
  }

  .card {
    width: 100%;
    max-width: 34rem;
    max-height: 80vh;
    overflow: auto;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    animation: nv-fade-up 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .card:focus-visible {
    outline: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      animation: none;
    }
  }

  .head {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-5);
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .title {
    font-family: var(--font-serif);
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--ink);
  }
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink-soft);
    transition:
      background 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;
  }
  .close:hover {
    background: var(--surface-sunken);
    color: var(--ink);
  }

  .body {
    display: flex;
    flex-direction: column;
  }

  .sect {
    padding: var(--space-5);
  }
  .sect + .sect {
    border-top: 1px solid var(--line);
  }

  .empty {
    padding: var(--space-7) var(--space-5);
    text-align: center;
    color: var(--ink-muted);
    font-size: 0.9rem;
  }

  /* Segmented site selector (matches the settings theme picker) */
  .seg {
    display: flex;
    gap: 0.25rem;
    padding: 0.2rem;
    background: var(--surface-sunken);
    border-radius: var(--radius-sm);
  }
  .seg-btn {
    flex: 1;
    padding: var(--space-2) 0;
    border: none;
    border-radius: calc(var(--radius-sm) - 2px);
    background: transparent;
    color: var(--ink-soft);
    font-size: 0.8rem;
    font-weight: 500;
    transition:
      background 0.16s ease,
      color 0.16s ease;
  }
  .seg-btn:hover {
    color: var(--ink);
  }
  .seg-btn.active {
    background: var(--surface);
    color: var(--accent-strong);
    box-shadow: var(--shadow-sm);
  }

  .hint {
    margin-top: var(--space-3);
    font-size: 0.76rem;
    line-height: 1.6;
    color: var(--ink-muted);
  }

  /* Section block: label + actions, then the converted text */
  .bhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .blabel {
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--ink-soft);
  }
  .actions {
    display: inline-flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  .act {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink-soft);
    font-size: 0.76rem;
    font-weight: 500;
    white-space: nowrap;
    transition:
      background 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;
  }
  .act:hover {
    background: var(--surface-sunken);
    color: var(--ink);
  }
  .act.done {
    border-color: var(--ok);
    color: var(--ok);
  }

  .out {
    width: 100%;
    margin-top: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-sunken);
    color: var(--ink);
    font-family: ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace;
    font-size: 0.82rem;
    line-height: 1.7;
    resize: vertical;
  }
  .note {
    min-height: 4rem;
  }
  .body-out {
    min-height: 10rem;
  }
</style>
