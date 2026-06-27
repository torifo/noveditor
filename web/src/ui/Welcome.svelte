<script lang="ts">
  // First-run greeting, shown once (App owns the `noveditor:onboarded:v1` flag). Calm and
  // dismissible — Esc / outside-click / the はじめる button all close it. Mirrors the overlay
  // dismissal pattern used by HelpOverlay / SettingsPanel.
  let { onClose }: { onClose: () => void } = $props()

  let cardEl = $state<HTMLDivElement | null>(null)
  let startEl = $state<HTMLButtonElement | null>(null)

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
    queueMicrotask(() => startEl?.focus())
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
    aria-labelledby="welcome-title"
  >
    <img class="mark" src="/favicon.svg" alt="" width="44" height="44" />
    <h2 class="title" id="welcome-title">ノヴェディタへようこそ</h2>
    <p class="lead">静かな紙の上で、思いついた一行から書きはじめられます。</p>

    <ul class="tips">
      <li>
        <span class="ico" aria-hidden="true">＋</span>
        <span>「＋ 新規小説」から書きはじめましょう。話を足せば連載にもなります。</span>
      </li>
      <li>
        <span class="ico" aria-hidden="true">✓</span>
        <span>書いたそばから、自動で保存されます。</span>
      </li>
      <li>
        <span class="ico" aria-hidden="true">⌘</span>
        <span><kbd>⌘K</kbd> で検索と操作、<kbd>?</kbd> でヘルプ、<kbd>☰</kbd> で一覧の開閉。</span>
      </li>
    </ul>

    <button class="start" bind:this={startEl} onclick={onClose}>はじめる</button>
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
    background: rgba(35, 32, 43, 0.22);
  }

  .card {
    width: 100%;
    max-width: 26rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-3);
    padding: var(--space-6);
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    animation: nv-fade-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @media (prefers-reduced-motion: reduce) {
    .card {
      animation: none;
    }
  }

  .mark {
    width: 2.75rem;
    height: 2.75rem;
    display: block;
  }
  .title {
    font-family: var(--font-serif);
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--ink);
  }
  .lead {
    color: var(--ink-soft);
    font-size: 0.95rem;
    line-height: 1.7;
    max-width: 22rem;
  }

  .tips {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: 100%;
    text-align: left;
  }
  .tips li {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    font-size: 0.9rem;
    color: var(--ink-soft);
    line-height: 1.6;
  }
  .ico {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: var(--radius-pill);
    background: var(--accent-wash);
    color: var(--accent-strong);
    font-size: 0.85rem;
    font-weight: 600;
  }

  kbd {
    display: inline-block;
    min-width: 1.4rem;
    padding: 0.05rem 0.35rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-sunken);
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: 0.78rem;
    font-weight: 600;
    text-align: center;
  }

  .start {
    margin-top: var(--space-4);
    padding: var(--space-3) var(--space-6);
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
  .start:hover {
    background: var(--accent-strong);
  }
  .start:active {
    transform: scale(0.98);
  }
</style>
