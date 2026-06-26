<script lang="ts">
  import type { AppState } from '../state/appState.svelte'

  let { app, onNavigate }: { app: AppState; onNavigate?: () => void } = $props()

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function displayTitle(title: string): string {
    return title.trim().length > 0 ? title : '（無題）'
  }

  async function onOpen(id: string) {
    await app.open(id)
    onNavigate?.()
  }

  async function onNew() {
    await app.createNew()
    onNavigate?.()
  }

  // No blocking confirm: delete immediately and offer Undo via a non-blocking toast (AppState).
  async function onDelete(id: string) {
    await app.remove(id)
  }
</script>

<aside class="list">
  <div class="head">
    <h2>原稿</h2>
    <button class="new" onclick={onNew} aria-label="新規原稿を作成">
      <span class="plus" aria-hidden="true">＋</span>
      <span>新規</span>
    </button>
  </div>

  {#if app.summaries.length === 0}
    <p class="empty">原稿はまだありません</p>
  {:else}
    <ul>
      {#each app.summaries as s (s.id)}
        <li class:active={s.id === app.currentId}>
          <button class="open" onclick={() => onOpen(s.id)}>
            <span class="t">{displayTitle(s.title)}</span>
            <span class="d">{formatDate(s.updatedAt)}</span>
          </button>
          <button
            class="del"
            aria-label={`「${displayTitle(s.title)}」を削除`}
            onclick={() => onDelete(s.id)}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path
                d="M6 7h12M9 7V5h6v2m-7 0 .7 12.1A1 1 0 0 0 9.7 20h4.6a1 1 0 0 0 1-.9L16 7"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  .list {
    padding: var(--space-4) var(--space-3);
    box-sizing: border-box;
    height: 100%;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-2) var(--space-3);
    margin-bottom: var(--space-2);
    border-bottom: 1px solid var(--line);
  }
  h2 {
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--ink-muted);
    text-transform: none;
  }
  .new {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    background: var(--surface);
    color: var(--ink-soft);
    font-size: 0.82rem;
    font-weight: 500;
    transition:
      border-color 0.18s ease,
      color 0.18s ease,
      background 0.18s ease,
      transform 0.12s ease;
  }
  .new:hover {
    border-color: var(--accent);
    color: var(--accent-strong);
    background: var(--accent-wash);
  }
  .new:active {
    transform: scale(0.97);
  }
  .new .plus {
    font-size: 0.9rem;
    line-height: 1;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  li {
    position: relative;
    display: flex;
    align-items: stretch;
    border-radius: var(--radius-sm);
    transition: background 0.18s ease;
  }
  li:hover {
    background: var(--surface-sunken);
  }
  li.active {
    background: var(--accent-wash);
  }
  /* Purple accent rail on the active item. */
  li.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.4rem;
    bottom: 0.4rem;
    width: 3px;
    border-radius: var(--radius-pill);
    background: var(--accent);
  }

  .open {
    flex: 1;
    min-width: 0;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    background: none;
    border: none;
    padding: var(--space-2) var(--space-3);
  }
  .open .t {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  li.active .open .t {
    color: var(--accent-strong);
  }
  .open .d {
    font-size: 0.72rem;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }

  .del {
    display: grid;
    place-items: center;
    width: 2rem;
    flex-shrink: 0;
    border: none;
    background: none;
    color: var(--ink-muted);
    border-radius: var(--radius-sm);
    opacity: 0;
    transition:
      opacity 0.18s ease,
      color 0.18s ease,
      background 0.18s ease,
      transform 0.12s ease;
  }
  li:hover .del,
  .del:focus-visible {
    opacity: 1;
  }
  .del:hover {
    color: var(--danger);
    background: rgba(192, 71, 58, 0.1);
  }
  .del:active {
    transform: scale(0.9);
  }

  .empty {
    font-size: 0.85rem;
    color: var(--ink-muted);
    padding: var(--space-2);
  }

  /* Touch devices have no hover — always show the delete affordance. */
  @media (hover: none) {
    .del {
      opacity: 0.6;
    }
  }
</style>
