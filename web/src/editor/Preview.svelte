<script lang="ts">
  import { renderRuby } from './renderRuby'

  // Read-only ruby preview rendered in the Mincho paper style. Kept isolated from the editor so a
  // future 縦書き (vertical) mode can reuse the same `renderRuby` util.
  //
  // Around the 本文 we render up to four optional notes:
  //   novelForeNote  — 小説共通のお知らせ（全話・冒頭）
  //   foreNote       — この話のお知らせ（冒頭）
  //   afterNote      — この話のあとがき（末尾）
  //   novelAfterNote — 小説共通のあとがき（全話・末尾）
  let {
    body,
    title,
    foreNote = '',
    afterNote = '',
    novelForeNote = '',
    novelAfterNote = '',
  }: {
    body: string
    title: string
    foreNote?: string
    afterNote?: string
    novelForeNote?: string
    novelAfterNote?: string
  } = $props()

  const html = $derived(renderRuby(body))
  const displayTitle = $derived(title.trim().length > 0 ? title : '（無題）')

  // Each note is rendered only when it has content. They share `renderRuby` so ruby (ルビ) and
  // bouten (圏点) notation work inside notes too; the util HTML-escapes first, so `{@html}` is safe.
  const novelForeHtml = $derived(novelForeNote.trim() ? renderRuby(novelForeNote) : '')
  const foreHtml = $derived(foreNote.trim() ? renderRuby(foreNote) : '')
  const afterHtml = $derived(afterNote.trim() ? renderRuby(afterNote) : '')
  const novelAfterHtml = $derived(novelAfterNote.trim() ? renderRuby(novelAfterNote) : '')
</script>

<article class="preview" aria-label="プレビュー">
  <h2 class="pv-title">{displayTitle}</h2>

  {#if novelForeHtml}
    <div class="pv-note pv-note-fore pv-note-common">
      <p class="pv-note-label">お知らせ</p>
      <div class="pv-note-text">{@html novelForeHtml}</div>
    </div>
  {/if}
  {#if foreHtml}
    <div class="pv-note pv-note-fore">
      <p class="pv-note-label">お知らせ</p>
      <div class="pv-note-text">{@html foreHtml}</div>
    </div>
  {/if}

  {#if body.trim().length === 0}
    <p class="pv-empty">本文はまだありません</p>
  {:else}
    <!-- renderRuby HTML-escapes all source text first, so this is injection-safe. -->
    <div class="pv-body">{@html html}</div>
  {/if}

  {#if afterHtml}
    <div class="pv-note pv-note-after">
      <p class="pv-note-label">あとがき</p>
      <div class="pv-note-text">{@html afterHtml}</div>
    </div>
  {/if}
  {#if novelAfterHtml}
    <div class="pv-note pv-note-after pv-note-common">
      <p class="pv-note-label">あとがき</p>
      <div class="pv-note-text">{@html novelAfterHtml}</div>
    </div>
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
    overflow-wrap: break-word;
  }

  /* Notes (お知らせ / あとがき): clearly secondary to 本文 — smaller, softer ink, set inside a
     faint paper-inset box so it reads as supplementary without any loud chrome. Tokens only, so it
     stays calm across 紙 / セピア / 夜. */
  .pv-note {
    font-family: var(--font-serif);
    font-size: 0.9rem;
    line-height: var(--body-line-height);
    color: var(--ink-soft);
    background: var(--surface-sunken);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    margin: var(--space-5) 0;
  }

  /* 小説共通の note (全話) は、この話の note より一段だけ控えめに。 */
  .pv-note-common {
    opacity: 0.9;
  }

  .pv-note-label {
    font-family: var(--font-serif);
    font-size: 0.7rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    color: var(--ink-muted);
    margin: 0 0 var(--space-2);
  }

  .pv-note-text {
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }

  /* Ruby tuning: a calm, slightly smaller reading gloss. Shared by 本文 and notes. */
  .pv-body :global(rt),
  .pv-note :global(rt) {
    font-size: 0.5em;
    color: var(--ink-soft);
    font-weight: 400;
    letter-spacing: 0;
    -webkit-user-select: none;
    user-select: none;
  }

  /* Bouten (圏点 / 傍点): sesame-dot emphasis marks above horizontal text.
     font-style is reset to normal — this is emphasis dots, not italic slant.
     The vendor-prefixed property carries over to a future 縦書き (vertical) view.
     Shared by 本文 and notes so emphasis renders consistently. */
  .pv-body :global(em.bouten),
  .pv-note :global(em.bouten) {
    font-style: normal;
    text-emphasis: filled sesame var(--ink);
    -webkit-text-emphasis: filled sesame var(--ink);
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
