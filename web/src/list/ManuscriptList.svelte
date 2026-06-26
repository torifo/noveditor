<script lang="ts">
  import type { AppState } from '../state/appState.svelte'

  let { app }: { app: AppState } = $props()

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

  async function onDelete(id: string, title: string) {
    // Provisional confirm UI.
    if (confirm(`「${displayTitle(title)}」を削除しますか？`)) {
      await app.remove(id)
    }
  }
</script>

<aside class="list">
  <div class="head">
    <h2>原稿一覧</h2>
    <button class="new" onclick={() => app.createNew()}>＋新規</button>
  </div>

  {#if app.summaries.length === 0}
    <p class="empty">原稿はまだありません</p>
  {:else}
    <ul>
      {#each app.summaries as s (s.id)}
        <li class:active={s.id === app.currentId}>
          <button class="open" onclick={() => app.open(s.id)}>
            <span class="t">{displayTitle(s.title)}</span>
            <span class="d">{formatDate(s.updatedAt)}</span>
          </button>
          <button class="del" title="削除" onclick={() => onDelete(s.id, s.title)}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  .list {
    width: 240px;
    flex-shrink: 0;
    border-right: 1px solid #ddd;
    padding: 1rem;
    box-sizing: border-box;
    overflow-y: auto;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  h2 {
    font-size: 1rem;
    margin: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  li {
    display: flex;
    align-items: stretch;
    gap: 0.25rem;
    border-radius: 4px;
  }
  li.active {
    background: #eef4ff;
  }
  .open {
    flex: 1;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    background: none;
    border: none;
    padding: 0.4rem 0.5rem;
    cursor: pointer;
  }
  .open .t {
    font-size: 0.9rem;
  }
  .open .d {
    font-size: 0.72rem;
    color: #888;
  }
  .del {
    border: none;
    background: none;
    color: #999;
    cursor: pointer;
  }
  .del:hover {
    color: #c00;
  }
  .empty {
    font-size: 0.85rem;
    color: #888;
  }
</style>
