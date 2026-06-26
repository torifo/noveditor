<script lang="ts">
  import { renderRuby } from './renderRuby'

  // Read-only ruby preview rendered in the Mincho paper style. Kept isolated from the editor so a
  // future 縦書き (vertical) mode can reuse the same `renderRuby` util.
  let { body, title }: { body: string; title: string } = $props()

  const html = $derived(renderRuby(body))
  const displayTitle = $derived(title.trim().length > 0 ? title : '無題')
</script>

<article class="preview" aria-label="プレビュー">
  <h2 class="pv-title">{displayTitle}</h2>
  {#if body.trim().length === 0}
    <p class="pv-empty">本文がまだありません。</p>
  {:else}
    <!-- renderRuby HTML-escapes all source text first, so this is injection-safe. -->
    <div class="pv-body">{@html html}</div>
  {/if}
</article>

<style>
  .preview {
    flex: 1;
    min-height: 0;
    width: 100%;
    max-width: calc(var(--reading-measure) + var(--space-6) * 2);
    margin: 0 auto;
    padding: var(--space-6) var(--space-6) var(--space-6);
    box-sizing: border-box;
    overflow-y: auto;
  }

  .pv-title {
    font-family: var(--font-serif);
    font-size: 1.7rem;
    font-weight: 600;
    line-height: 1.4;
    color: var(--ink);
    padding: var(--space-2) 0;
    margin-bottom: var(--space-4);
    border-bottom: 1px solid var(--line);
  }

  .pv-body {
    font-family: var(--font-serif);
    font-size: var(--editor-font-size, 1.12rem);
    line-height: var(--body-line-height);
    letter-spacing: 0.02em;
    color: var(--ink);
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Ruby tuning: a calm, slightly smaller reading gloss. */
  .pv-body :global(rt) {
    font-size: 0.5em;
    color: var(--ink-soft);
    font-weight: 400;
    letter-spacing: 0;
    user-select: none;
  }

  .pv-empty {
    font-family: var(--font-serif);
    color: var(--ink-muted);
    font-size: 1rem;
  }

  @media (max-width: 720px) {
    .preview {
      padding: var(--space-4) var(--space-4);
    }
  }
</style>
