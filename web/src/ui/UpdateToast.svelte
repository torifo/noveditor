<script lang="ts">
  import { pwaUpdate } from '../state/pwaUpdate.svelte'
</script>

{#if pwaUpdate.needRefresh}
  <div class="toast-layer">
    <!-- role="status" + aria-live=polite announces without stealing focus. -->
    <div class="toast" role="status" aria-live="polite">
      <span class="msg">新しいバージョンがあります</span>
      <button class="apply" onclick={() => pwaUpdate.update()}>更新</button>
      <button class="dismiss" aria-label="通知を閉じる" onclick={() => pwaUpdate.dismiss()}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .toast-layer {
    position: fixed;
    /* Center within the editor area (right of the sidebar), not the whole viewport. */
    left: var(--sidebar-w, 0);
    right: 0;
    /* Stack above the undo toast (and clear of the status bar) so the two never overlap. */
    bottom: calc(var(--statusbar-h) + var(--space-5) + 3.5rem);
    display: flex;
    justify-content: center;
    padding: 0 var(--space-4);
    z-index: 41;
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    max-width: min(92vw, 30rem);
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    animation: nv-toast-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .msg {
    font-size: 0.88rem;
    color: var(--ink-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .apply {
    flex-shrink: 0;
    padding: var(--space-1) var(--space-2);
    border: none;
    background: none;
    color: var(--accent-strong);
    font-size: 0.88rem;
    font-weight: 600;
    border-radius: var(--radius-sm);
    transition:
      background 0.18s ease,
      transform 0.12s ease;
  }
  .apply:hover {
    background: var(--accent-wash);
  }
  .apply:active {
    transform: scale(0.96);
  }

  .dismiss {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: none;
    color: var(--ink-muted);
    border-radius: var(--radius-sm);
    transition:
      color 0.18s ease,
      background 0.18s ease,
      transform 0.12s ease;
  }
  .dismiss:hover {
    color: var(--ink);
    background: var(--surface-sunken);
  }
  .dismiss:active {
    transform: scale(0.94);
  }

  @keyframes nv-toast-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
