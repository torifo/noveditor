<script lang="ts">
  import {
    type Settings,
    type Theme,
    FONT_SIZE_MIN,
    FONT_SIZE_MAX,
    LINE_WIDTH_MIN,
    LINE_WIDTH_MAX,
  } from '../state/settings.svelte'

  let { settings }: { settings: Settings } = $props()

  let open = $state(false)
  let rootEl = $state<HTMLDivElement | null>(null)
  let panelEl = $state<HTMLDivElement | null>(null)
  let triggerEl = $state<HTMLButtonElement | null>(null)

  const themes: { value: Theme; label: string }[] = [
    { value: 'light', label: '紙' },
    { value: 'sepia', label: 'セピア' },
    { value: 'dark', label: '夜' },
  ]

  // Line width is stored in rem, but writers think in 文字/行. The column is `lineWidth`rem
  // (1rem = 16px) and a full-width JP glyph ≈ the editor font size, so chars/line ≈ width/size.
  const charsPerLine = $derived(Math.round((settings.lineWidth * 16) / settings.fontSize))

  function toggle() {
    open = !open
  }

  function close(refocus = false) {
    open = false
    if (refocus) triggerEl?.focus()
  }

  // Esc closes (and returns focus to the trigger); pointerdown outside closes.
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      close(true)
    }
  }
  function onPointerDown(e: PointerEvent) {
    if (!open) return
    if (rootEl && !rootEl.contains(e.target as Node)) close()
  }

  $effect(() => {
    if (!open) return
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeydown, true)
    // Move focus into the panel for keyboard users.
    queueMicrotask(() => panelEl?.focus())
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeydown, true)
    }
  })
</script>

<div class="settings" bind:this={rootEl}>
  <button
    class="gear"
    bind:this={triggerEl}
    aria-label="設定"
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={toggle}
  >
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
      />
      <path
        d="M19.4 13a7.6 7.6 0 0 0 .05-2l1.7-1.3-1.9-3.3-2 .8a7.6 7.6 0 0 0-1.7-1l-.3-2.1H9.7l-.3 2.1a7.6 7.6 0 0 0-1.7 1l-2-.8L3.8 9.7 5.5 11a7.6 7.6 0 0 0 0 2l-1.7 1.3 1.9 3.3 2-.8c.5.4 1.1.7 1.7 1l.3 2.1h4.6l.3-2.1c.6-.3 1.2-.6 1.7-1l2 .8 1.9-3.3-1.7-1.3Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
    </svg>
  </button>

  {#if open}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="panel"
      bind:this={panelEl}
      role="dialog"
      aria-label="設定"
      tabindex="-1"
    >
      <section class="group">
        <span class="glabel" id="set-theme">テーマ</span>
        <div class="seg" role="group" aria-labelledby="set-theme">
          {#each themes as t (t.value)}
            <button
              class="seg-btn"
              class:active={settings.theme === t.value}
              aria-pressed={settings.theme === t.value}
              onclick={() => settings.setTheme(t.value)}
            >
              {t.label}
            </button>
          {/each}
        </div>
      </section>

      <section class="group">
        <label class="glabel" for="set-font">
          文字サイズ <span class="val">{settings.fontSize}px</span>
        </label>
        <input
          id="set-font"
          type="range"
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step="1"
          value={settings.fontSize}
          oninput={(e) => settings.setFontSize(Number(e.currentTarget.value))}
        />
      </section>

      <section class="group">
        <label class="glabel" for="set-width">
          行幅 <span class="val">1行 約{charsPerLine}文字</span>
        </label>
        <input
          id="set-width"
          type="range"
          min={LINE_WIDTH_MIN}
          max={LINE_WIDTH_MAX}
          step="1"
          value={settings.lineWidth}
          oninput={(e) => settings.setLineWidth(Number(e.currentTarget.value))}
        />
      </section>

      <section class="group row">
        <label class="glabel" for="set-tw">タイプライタースクロール</label>
        <button
          id="set-tw"
          class="switch"
          role="switch"
          aria-label="タイプライタースクロール"
          aria-checked={settings.typewriter}
          onclick={() => settings.toggleTypewriter()}
        >
          <span class="knob"></span>
        </button>
      </section>
    </div>
  {/if}
</div>

<style>
  .settings {
    position: relative;
    display: inline-flex;
  }

  .gear {
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
  .gear:hover {
    background: var(--surface-sunken);
    color: var(--ink);
  }
  .gear[aria-expanded='true'] {
    border-color: var(--accent);
    color: var(--accent-strong);
  }

  .panel {
    position: absolute;
    top: calc(100% + var(--space-2));
    right: 0;
    z-index: 50;
    width: 16rem;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    animation: nv-pop 0.16s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .panel:focus-visible {
    outline: none;
  }

  @keyframes nv-pop {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .group.row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  .glabel {
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ink-soft);
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .val {
    font-size: 0.74rem;
    font-weight: 500;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }

  /* Segmented theme control */
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

  input[type='range'] {
    width: 100%;
    accent-color: var(--accent);
  }

  /* Toggle switch */
  .switch {
    position: relative;
    width: 2.6rem;
    height: 1.5rem;
    flex-shrink: 0;
    padding: 0;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    background: var(--surface-sunken);
    transition:
      background 0.18s ease,
      border-color 0.18s ease;
  }
  .switch[aria-checked='true'] {
    background: var(--accent);
    border-color: var(--accent);
  }
  .knob {
    position: absolute;
    top: 50%;
    left: 0.18rem;
    width: 1.05rem;
    height: 1.05rem;
    transform: translateY(-50%);
    border-radius: 50%;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    transition: left 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .switch[aria-checked='true'] .knob {
    left: calc(100% - 1.23rem);
  }
</style>
