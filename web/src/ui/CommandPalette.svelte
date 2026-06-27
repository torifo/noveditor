<script lang="ts">
  import type { AppState } from '../state/appState.svelte'
  import type { Settings } from '../state/settings.svelte'
  import type { EpisodeSearchHit } from '../repository/NovelRepository'
  import { buildCommands, filterCommands, type Command } from './commands'

  let {
    app,
    settings,
    onClose,
    openHelp,
    toggleSidebar,
    openExport,
  }: {
    app: AppState
    settings: Settings
    onClose: () => void
    openHelp: () => void
    toggleSidebar: () => void
    openExport: () => void
  } = $props()

  let query = $state('')
  let hits = $state<EpisodeSearchHit[]>([])
  let activeIndex = $state(0)
  let inputEl = $state<HTMLInputElement>()

  // Commands re-filter synchronously as you type (and re-read enabled()).
  // ctx is built inside the derived closure so it reads the live props.
  const commands = $derived(
    filterCommands(buildCommands({ app, settings, openHelp, toggleSidebar, openExport }), query),
  )

  // A flat list (commands first, then search hits) so arrow-key navigation spans both groups.
  type Item =
    | { kind: 'command'; command: Command }
    | { kind: 'hit'; hit: EpisodeSearchHit }
  const items = $derived<Item[]>([
    ...commands.map((command) => ({ kind: 'command', command }) as Item),
    ...hits.map((hit) => ({ kind: 'hit', hit }) as Item),
  ])

  // Body/title full-text search is async + debounced; a cleanup guards against races.
  $effect(() => {
    const q = query.trim()
    if (q === '') {
      hits = []
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      const r = await app.search(q)
      if (!cancelled) hits = r
    }, 120)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  })

  // Reset the highlight to the top whenever the query changes.
  $effect(() => {
    void query
    activeIndex = 0
  })

  // Keep the highlight in range as results shrink.
  $effect(() => {
    if (activeIndex > items.length - 1) activeIndex = Math.max(0, items.length - 1)
  })

  $effect(() => {
    inputEl?.focus()
  })

  function displayTitle(t: string, fallback = '（無題）'): string {
    return t.trim().length > 0 ? t : fallback
  }

  async function runItem(item: Item | undefined): Promise<void> {
    if (!item) return
    onClose()
    if (item.kind === 'command') {
      await item.command.run()
    } else {
      await app.goToEpisode(item.hit.novelId, item.hit.episodeId)
    }
  }

  function onInputKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      activeIndex = Math.min(activeIndex + 1, items.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      activeIndex = Math.max(activeIndex - 1, 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void runItem(items[activeIndex])
    }
  }

  function onBackdropPointerdown(e: PointerEvent): void {
    if (e.target === e.currentTarget) onClose()
  }

  const commandCount = $derived(commands.length)
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onpointerdown={onBackdropPointerdown}>
  <div class="palette" role="dialog" aria-modal="true" aria-label="コマンドパレット">
    <input
      bind:this={inputEl}
      bind:value={query}
      class="query"
      type="text"
      placeholder="コマンドを実行／本文・タイトルを検索…"
      aria-label="コマンド・検索"
      role="combobox"
      aria-expanded="true"
      aria-controls="cp-results"
      aria-activedescendant={items.length > 0 ? `cp-item-${activeIndex}` : undefined}
      onkeydown={onInputKeydown}
      autocomplete="off"
      spellcheck="false"
    />

    <div class="results" id="cp-results" role="listbox">
      {#if items.length === 0}
        <p class="empty">見つかりませんでした</p>
      {/if}

      {#if commandCount > 0}
        <p class="group-label">コマンド</p>
        {#each commands as command, i (command.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="row"
            id={`cp-item-${i}`}
            class:active={activeIndex === i}
            role="option"
            aria-selected={activeIndex === i}
            tabindex="-1"
            onpointerenter={() => (activeIndex = i)}
            onclick={() => void runItem({ kind: 'command', command })}
          >
            <span class="row-label">{command.label}</span>
            {#if command.hint}<kbd class="hint">{command.hint}</kbd>{/if}
          </div>
        {/each}
      {/if}

      {#if hits.length > 0}
        <p class="group-label">検索結果</p>
        {#each hits as hit, i (hit.episodeId)}
          {@const idx = commandCount + i}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="row hit"
            id={`cp-item-${idx}`}
            class:active={activeIndex === idx}
            role="option"
            aria-selected={activeIndex === idx}
            tabindex="-1"
            onpointerenter={() => (activeIndex = idx)}
            onclick={() => void runItem({ kind: 'hit', hit })}
          >
            <span class="hit-main">
              <span class="hit-title">{displayTitle(hit.episodeTitle)}</span>
              <span class="hit-novel">{displayTitle(hit.novelTitle, '（無題の小説）')}</span>
            </span>
            {#if hit.snippet}<span class="hit-snippet">{hit.snippet}</span>{/if}
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgba(35, 32, 43, 0.28);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 12vh var(--space-4) var(--space-4);
    animation: nv-fade-up 0.16s ease both;
  }

  .palette {
    width: 100%;
    max-width: 36rem;
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  .query {
    flex-shrink: 0;
    border: none;
    border-bottom: 1px solid var(--line);
    background: transparent;
    padding: var(--space-4) var(--space-5);
    font-size: 1.05rem;
    color: var(--ink);
    outline: none;
  }
  .query::placeholder {
    color: var(--ink-muted);
  }

  .results {
    overflow-y: auto;
    padding: var(--space-2);
  }

  .group-label {
    margin: var(--space-2) var(--space-3) var(--space-1);
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    text-transform: uppercase;
  }

  .empty {
    margin: var(--space-5);
    text-align: center;
    color: var(--ink-muted);
    font-size: 0.9rem;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--ink);
  }
  .row.active {
    background: var(--accent-wash);
    color: var(--accent-strong);
  }

  .row-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hint {
    flex-shrink: 0;
    font-family: var(--font-sans);
    font-size: 0.72rem;
    color: var(--ink-muted);
    background: var(--surface-sunken);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 0.05rem 0.4rem;
  }
  .row.active .hint {
    color: var(--accent-strong);
  }

  /* Search-hit rows are two-line: title + novel, then a muted snippet. */
  .row.hit {
    flex-direction: column;
    align-items: stretch;
    gap: 0.15rem;
  }
  .hit-main {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    min-width: 0;
  }
  .hit-title {
    flex-shrink: 0;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hit-novel {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.78rem;
    color: var(--ink-muted);
  }
  .hit-snippet {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8rem;
    color: var(--ink-soft);
  }
  .row.hit.active .hit-novel,
  .row.hit.active .hit-snippet {
    color: var(--accent-strong);
  }
</style>
