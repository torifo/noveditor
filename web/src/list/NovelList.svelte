<script lang="ts">
  import type { AppState } from '../state/appState.svelte'
  import { isSampleNovel } from '../state/sampleNovel'

  let { app, onNavigate }: { app: AppState; onNavigate?: () => void } = $props()

  // Inline novel-title/synopsis editor (one novel at a time).
  let editingNovelId = $state<string | null>(null)
  let editTitle = $state('')
  let editSynopsis = $state('')
  // 小説共通の「お知らせ」(全話の冒頭) と「あとがき」(全話の末尾)。
  let editForeNote = $state('')
  let editAfterNote = $state('')

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function displayTitle(title: string, fallback = '（無題）'): string {
    return title.trim().length > 0 ? title : fallback
  }
  // 小説名の無題は「（無題の小説）」で区別する（話の無題＝「（無題）」）。
  const NOVEL_UNTITLED = '（無題の小説）'

  // Clicking a novel opens it (and its default 話). A single-話 novel opens that 話 directly
  // (single-novel optimization); a multi-話 novel additionally expands its 話 list.
  async function onOpenNovel(id: string) {
    await app.openNovel(id)
    onNavigate?.()
  }

  async function onOpenEpisode(id: string) {
    await app.openEpisode(id)
    onNavigate?.()
  }

  async function onNewNovel() {
    await app.createNovel()
    onNavigate?.()
  }

  async function onNewEpisode() {
    await app.createEpisode()
    onNavigate?.()
  }

  // No blocking confirm: delete immediately and offer Undo via a non-blocking toast (AppState).
  async function onDeleteNovel(id: string) {
    if (editingNovelId === id) editingNovelId = null
    await app.removeNovel(id)
  }

  async function onDeleteEpisode(id: string) {
    await app.removeEpisode(id)
  }

  async function startEdit(id: string) {
    const meta = await app.getNovelMeta(id)
    editTitle = meta.title
    editSynopsis = meta.synopsis
    editForeNote = meta.foreNote
    editAfterNote = meta.afterNote
    editingNovelId = id
  }

  function cancelEdit() {
    editingNovelId = null
  }

  async function saveEdit(id: string) {
    await app.updateNovelMeta(id, editTitle, editSynopsis, editForeNote, editAfterNote)
    editingNovelId = null
  }

  // ---- Drag-and-drop episode reorder ----
  // dragFromIndex: index of the episode currently being dragged (null when idle)
  // dropTargetIndex: insertion slot (0..episodes.length) where the drop line is shown
  let dragFromIndex = $state<number | null>(null)
  let dropTargetIndex = $state<number | null>(null)

  function handleDragStart(e: DragEvent, index: number): void {
    dragFromIndex = index
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      // Store the source index so accidental cross-novel drops can be ignored.
      e.dataTransfer.setData('text/plain', String(index))
    }
  }

  /** Calculate the insertion slot (before/after the hovered element) from pointer position. */
  function calcSlot(e: DragEvent, index: number): number {
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    return e.clientY < rect.top + rect.height / 2 ? index : index + 1
  }

  function handleEpDragOver(e: DragEvent, index: number): void {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    const slot = calcSlot(e, index)
    // Suppress the indicator when dropping would be a no-op (on itself or adjacent slot).
    if (dragFromIndex !== null && (slot === dragFromIndex || slot === dragFromIndex + 1)) {
      dropTargetIndex = null
      return
    }
    dropTargetIndex = slot
  }

  function handleEpDrop(e: DragEvent, index: number): void {
    e.preventDefault()
    const from = dragFromIndex
    const slot = calcSlot(e, index)
    // Clear drag state immediately so the UI snaps back while the async save runs.
    dragFromIndex = null
    dropTargetIndex = null
    if (from === null) return
    // No-op: dropped on the same position.
    if (slot === from || slot === from + 1) return
    // Convert insertion slot to final element index after splice.
    // When the slot is after the source, removing the source shifts indices by -1.
    const to = slot > from ? slot - 1 : slot
    const nid = app.currentNovelId
    if (nid !== null) void app.reorderEpisode(nid, from, to)
  }

  function handleDragEnd(): void {
    dragFromIndex = null
    dropTargetIndex = null
  }

  /** Clear the drop indicator when the pointer leaves the episode list entirely. */
  function handleListDragLeave(e: DragEvent): void {
    const rel = e.relatedTarget as Node | null
    if (!rel || !(e.currentTarget as HTMLElement).contains(rel)) {
      dropTargetIndex = null
    }
  }
</script>

<aside class="list">
  <div class="head">
    <h2>小説</h2>
    <button class="new" onclick={onNewNovel} aria-label="新規小説を作成">
      <span class="plus" aria-hidden="true">＋</span>
      <span>新規小説</span>
    </button>
  </div>

  {#if app.novels.length === 0}
    <p class="empty">小説はまだありません</p>
  {:else}
    <ul class="novels">
      {#each app.novels as n (n.id)}
        {@const active = n.id === app.currentNovelId}
        {@const single = n.episodeCount <= 1}
        <li class="novel" class:active>
          {#if editingNovelId === n.id}
            <form class="edit" onsubmit={(e) => { e.preventDefault(); void saveEdit(n.id) }}>
              <input
                class="edit-title"
                type="text"
                placeholder="小説タイトル"
                aria-label="小説タイトル"
                bind:value={editTitle}
              />
              <textarea
                class="edit-synopsis"
                placeholder="あらすじ（任意）"
                aria-label="あらすじ"
                rows="2"
                bind:value={editSynopsis}
              ></textarea>
              <textarea
                class="edit-synopsis"
                placeholder="全話の冒頭に表示（任意）"
                aria-label="小説のお知らせ"
                rows="2"
                bind:value={editForeNote}
              ></textarea>
              <textarea
                class="edit-synopsis"
                placeholder="全話の末尾に表示（任意）"
                aria-label="小説のあとがき"
                rows="2"
                bind:value={editAfterNote}
              ></textarea>
              <div class="edit-actions">
                <button type="button" class="ghost" onclick={cancelEdit}>キャンセル</button>
                <button type="submit" class="primary">保存</button>
              </div>
            </form>
          {:else}
            <div class="novel-row">
              <button class="open novel-open" onclick={() => onOpenNovel(n.id)}>
                <span class="t">{displayTitle(n.title, NOVEL_UNTITLED)}</span>
                <span class="meta">
                  <span class="count">{n.episodeCount}話</span>
                  <span class="d">{formatDate(n.updatedAt)}</span>
                </span>
              </button>
              <div class="row-actions">
                {#if active}
                  <button class="act" onclick={onNewEpisode} aria-label="この小説に話を追加" title="話を追加">
                    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                    </svg>
                  </button>
                {/if}
                <button
                  class="act"
                  onclick={() => startEdit(n.id)}
                  aria-label={`「${displayTitle(n.title, NOVEL_UNTITLED)}」の情報を編集`}
                  title="小説情報を編集"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                    <path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.83-2.83L5 17.2V20z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
                  </svg>
                </button>
                {#if !isSampleNovel(n.id)}
                  <button
                    class="act del"
                    onclick={() => onDeleteNovel(n.id)}
                    aria-label={`「${displayTitle(n.title, NOVEL_UNTITLED)}」を削除`}
                    title="小説を削除"
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                      <path d="M6 7h12M9 7V5h6v2m-7 0 .7 12.1A1 1 0 0 0 9.7 20h4.6a1 1 0 0 0 1-.9L16 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                {/if}
              </div>
            </div>
          {/if}

          {#if active && !single}
            <ul
              class="episodes"
              ondragleave={handleListDragLeave}
              ondragover={(e) => e.preventDefault()}
            >
              {#each app.episodes as e, i (e.id)}
                <li
                  class="episode"
                  class:active={e.id === app.currentEpisodeId}
                  class:ep-dragging={dragFromIndex === i}
                  class:drop-above={dropTargetIndex === i}
                  class:drop-below={dropTargetIndex === app.episodes.length && i === app.episodes.length - 1}
                  draggable={true}
                  ondragstart={(ev) => handleDragStart(ev, i)}
                  ondragover={(ev) => handleEpDragOver(ev, i)}
                  ondrop={(ev) => handleEpDrop(ev, i)}
                  ondragend={handleDragEnd}
                  aria-grabbed={dragFromIndex === i ? 'true' : 'false'}
                >
                  <span class="drag-handle" aria-hidden="true" title="ドラッグして並べ替え">
                    <svg viewBox="0 0 8 14" width="8" height="14" fill="currentColor" aria-hidden="true">
                      <circle cx="2" cy="2" r="1.1"/>
                      <circle cx="6" cy="2" r="1.1"/>
                      <circle cx="2" cy="7" r="1.1"/>
                      <circle cx="6" cy="7" r="1.1"/>
                      <circle cx="2" cy="12" r="1.1"/>
                      <circle cx="6" cy="12" r="1.1"/>
                    </svg>
                  </span>
                  <button class="open ep-open" onclick={() => onOpenEpisode(e.id)}>
                    <span class="num" aria-hidden="true">{i + 1}</span>
                    <span class="ep-body">
                      <span class="t">{displayTitle(e.title)}</span>
                      <span class="d">{formatDate(e.updatedAt)}</span>
                    </span>
                  </button>
                  <div class="ep-actions">
                    <button
                      class="act"
                      onclick={() => app.moveEpisode(e.id, -1)}
                      disabled={i === 0}
                      aria-label="上へ移動"
                      title="上へ"
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                        <path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                    <button
                      class="act"
                      onclick={() => app.moveEpisode(e.id, 1)}
                      disabled={i === app.episodes.length - 1}
                      aria-label="下へ移動"
                      title="下へ"
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                        <path d="M6 10l6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </button>
                    {#if !isSampleNovel(n.id)}
                      <button
                        class="act del"
                        onclick={() => onDeleteEpisode(e.id)}
                        aria-label={`話「${displayTitle(e.title)}」を削除`}
                        title="話を削除"
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                          <path d="M6 7h12M9 7V5h6v2m-7 0 .7 12.1A1 1 0 0 0 9.7 20h4.6a1 1 0 0 0 1-.9L16 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                      </button>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
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
  }
  .novels {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  /* ---- Novel row ---- */
  .novel-row {
    position: relative;
    display: flex;
    align-items: stretch;
    border-radius: var(--radius-sm);
    transition: background 0.18s ease;
  }
  .novel-row:hover {
    background: var(--surface-sunken);
  }
  .novel.active > .novel-row {
    background: var(--accent-wash);
  }
  .novel.active > .novel-row::before {
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
    background: none;
    border: none;
  }
  .novel-open {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: var(--space-2) var(--space-3);
  }
  .novel-open .t {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .novel.active .novel-open .t {
    color: var(--accent-strong);
  }
  .meta {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-2);
  }
  .count {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--accent-strong);
    background: var(--accent-wash);
    border-radius: var(--radius-pill);
    padding: 0.05rem 0.4rem;
    flex-shrink: 0;
  }
  .d {
    font-size: 0.72rem;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }

  /* ---- Row action buttons ---- */
  .row-actions,
  .ep-actions {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }
  .act {
    display: grid;
    place-items: center;
    width: 1.85rem;
    align-self: stretch;
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
  .novel-row:hover .act,
  .novel.active > .novel-row .act,
  .episode:hover .act,
  .episode.active .act,
  .act:focus-visible {
    opacity: 1;
  }
  .act:hover {
    color: var(--accent-strong);
    background: var(--accent-wash);
  }
  .act.del:hover {
    color: var(--danger);
    background: rgba(192, 71, 58, 0.1);
  }
  .act:active {
    transform: scale(0.9);
  }
  .act:disabled {
    opacity: 0.2;
    cursor: default;
  }
  .episode:hover .act:disabled,
  .episode.active .act:disabled {
    opacity: 0.25;
  }

  /* ---- Episode sublist ---- */
  .episodes {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    margin: 0.15rem 0 0.3rem;
    padding-left: var(--space-3);
    border-left: 1px solid var(--line);
    margin-left: var(--space-3);
  }
  .episode {
    position: relative;
    display: flex;
    align-items: stretch;
    border-radius: var(--radius-sm);
    transition: background 0.18s ease;
  }
  .episode:hover {
    background: var(--surface-sunken);
  }
  .episode.active {
    background: var(--accent-wash);
  }
  .ep-open {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
  }
  .num {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 1.3rem;
    height: 1.3rem;
    border-radius: var(--radius-pill);
    background: var(--surface-sunken);
    color: var(--ink-muted);
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
  }
  .episode.active .num {
    background: var(--accent);
    color: var(--accent-contrast);
  }
  .ep-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }
  .ep-body .t {
    font-size: 0.84rem;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .episode.active .ep-body .t {
    color: var(--accent-strong);
  }

  /* ---- Inline novel editor ---- */
  .edit {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-2) var(--space-3);
    background: var(--surface-sunken);
    border-radius: var(--radius-sm);
  }
  .edit-title,
  .edit-synopsis {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    padding: var(--space-2);
    font: inherit;
    font-size: 0.85rem;
    color: var(--ink);
  }
  .edit-synopsis {
    resize: vertical;
    line-height: 1.5;
  }
  .edit-title:focus,
  .edit-synopsis:focus {
    outline: none;
    border-color: var(--accent);
  }
  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
  .edit-actions button {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 500;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink-soft);
  }
  .edit-actions .primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-contrast);
  }
  .edit-actions .ghost:hover {
    background: var(--surface-sunken);
  }

  .empty {
    font-size: 0.85rem;
    color: var(--ink-muted);
    padding: var(--space-2);
  }

  /* ---- Drag-and-drop affordance ---- */
  .drag-handle {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 1rem;
    padding-left: 0.15rem;
    color: var(--ink-muted);
    opacity: 0;
    cursor: grab;
    transition: opacity 0.18s ease;
    /* Avoid interfering with the adjacent ep-open button's click area. */
    pointer-events: auto;
  }
  .episode:hover .drag-handle,
  .episode.active .drag-handle {
    opacity: 0.45;
  }
  .drag-handle:hover {
    opacity: 0.9;
  }

  /* Dim the episode row being dragged. */
  .episode.ep-dragging {
    opacity: 0.35;
  }

  /* Drop indicator: a 2px accent line above (.drop-above) or below (.drop-below). */
  .episode.drop-above,
  .episode.drop-below {
    position: relative;
  }
  .episode.drop-above::before,
  .episode.drop-below::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--accent);
    border-radius: var(--radius-pill);
    pointer-events: none;
    z-index: 1;
  }
  .episode.drop-above::before {
    top: -1px;
  }
  .episode.drop-below::after {
    bottom: -1px;
  }

  /* Respect reduced-motion: skip transitions during drag interactions. */
  @media (prefers-reduced-motion: reduce) {
    .episode,
    .drag-handle {
      transition: none;
    }
  }

  /* Touch devices have no hover — always reveal actions. */
  @media (hover: none) {
    .act {
      opacity: 0.6;
    }
    /* On touch, drag-and-drop (HTML5) is not supported; show the handle faintly
       so the ↑/↓ buttons remain the primary reorder mechanism. */
    .drag-handle {
      display: none;
    }
  }
</style>
