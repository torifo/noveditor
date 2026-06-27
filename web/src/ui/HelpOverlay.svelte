<script lang="ts">
  let { onClose }: { onClose: () => void } = $props()

  let cardEl = $state<HTMLDivElement | null>(null)
  let closeEl = $state<HTMLButtonElement | null>(null)

  const shortcuts: { key: string; desc: string }[] = [
    { key: '⌘K', desc: 'コマンドパレット（操作・検索）' },
    { key: '?', desc: 'このヘルプ' },
    { key: '⌘S', desc: '保存' },
    { key: '⌘N', desc: '話を追加' },
    { key: '⌘⇧N', desc: '小説を追加' },
    { key: '⌘B', desc: '小説一覧の表示／非表示' },
    { key: '⌘E', desc: 'この話をエクスポート' },
    { key: '⌘\\', desc: '集中モード' },
    { key: '⌘⌥↑', desc: '前の話へ' },
    { key: '⌘⌥↓', desc: '次の話へ' },
    { key: 'Esc', desc: '閉じる／集中モードを終了' },
  ]

  // Escape closes; pressing ? again closes; pointerdown outside the card closes.
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    } else if (e.key === '?') {
      e.stopPropagation()
      e.preventDefault()
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
    }
  })
</script>

<div class="backdrop">
  <div
    class="card"
    bind:this={cardEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby="help-title"
  >
    <header class="head">
      <h2 class="title" id="help-title">ヘルプ</h2>
      <button class="close" bind:this={closeEl} aria-label="ヘルプを閉じる" onclick={onClose}>
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
      <section class="sect">
        <h3 class="shead">キーボードショートカット</h3>
        <dl class="keys">
          {#each shortcuts as s (s.desc)}
            <div class="krow">
              <dt><kbd>{s.key}</kbd></dt>
              <dd>{s.desc}</dd>
            </div>
          {/each}
        </dl>
        <p class="note">Windows・Linux では ⌘＝Ctrl、⌥＝Alt、⇧＝Shift</p>
      </section>

      <section class="sect">
        <h3 class="shead">記法</h3>
        <dl class="notations">
          <div class="nrow">
            <dt><code>｜漢字《かんじ》</code></dt>
            <dd>ふりがな（ルビ）</dd>
          </div>
          <div class="nrow">
            <dt><code>《《強調》》</code></dt>
            <dd>圏点（傍点）</dd>
          </div>
        </dl>
        <p class="note">プレビューで反映されます</p>
      </section>

      <section class="sect">
        <h3 class="shead">使い方</h3>
        <ol class="steps">
          <li>＋ で話を追加できます</li>
          <li>書くと自動で保存されます</li>
          <li>削除しても、画面下の通知の「元に戻す」からすぐに戻せます</li>
          <li>⌘K でいつでも検索・操作できます</li>
        </ol>
      </section>
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
    max-width: 30rem;
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

  .shead {
    margin-bottom: var(--space-3);
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--ink-soft);
  }

  /* Keyboard shortcut list */
  .keys,
  .notations {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
  }
  .krow {
    display: grid;
    grid-template-columns: 5.5rem 1fr;
    align-items: baseline;
    gap: var(--space-3);
  }
  .krow dt,
  .nrow dt {
    margin: 0;
  }
  .krow dd,
  .nrow dd {
    margin: 0;
    font-size: 0.88rem;
    color: var(--ink-soft);
  }

  kbd {
    display: inline-block;
    min-width: 1.5rem;
    padding: 0.12rem 0.4rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-sunken);
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.4;
    text-align: center;
    box-shadow: var(--shadow-sm);
  }

  /* Notation rows */
  .nrow {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  code {
    display: inline-block;
    padding: 0.12rem 0.4rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-sunken);
    color: var(--ink);
    font-family: ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace;
    font-size: 0.82rem;
  }

  .note {
    margin-top: var(--space-3);
    font-size: 0.76rem;
    color: var(--ink-muted);
  }

  /* Usage steps */
  .steps {
    margin: 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .steps li {
    font-size: 0.88rem;
    color: var(--ink-soft);
    line-height: 1.6;
  }
  .steps li::marker {
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
