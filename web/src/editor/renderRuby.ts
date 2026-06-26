/**
 * Ruby (ルビ / 振り仮名) and bouten (圏点 / 傍点) renderer — isolated, side-effect-free string → HTML.
 *
 * This seeds a future 縦書き (vertical) preview, so it is kept as a small pure util the Preview
 * component can `{@html}`. SAFETY: the input is HTML-escaped *first*, so base/rt content can never
 * inject markup; only the `<ruby>/<rt>/<br>/<em>` tags we emit are real HTML.
 *
 * Supported notation:
 *   Bouten (カクヨム-style, parsed FIRST to prevent mis-parsing as ruby):
 *   - `《《text》》` → `<em class="bouten">text</em>` (emphasis / sesame dots)
 *
 *   Ruby (青空文庫-style):
 *   - Pipe form:      `｜漢字《かんじ》` or `|漢字《かんじ》`
 *                     → the pipe marks where the ruby base starts; everything up to 《 is the base.
 *   - Shorthand form: `漢字《かんじ》`
 *                     → the run of kanji immediately before 《…》 becomes the base.
 *
 * Edge cases handled:
 *   - 《…》 with neither a pipe nor a preceding kanji run is left as literal text.
 *   - Mixed text before a shorthand (e.g. `お母さん漢字《かんじ》`) only rubifies the trailing
 *     kanji run (漢字), leaving お母さん as-is — the regex anchors the base to 《.
 *   - Half-width `|` and full-width `｜` are both accepted as base markers.
 *   - Ruby/bouten groups never span a newline (the inner classes exclude `\n`).
 *   - Newlines are preserved as `<br>`.
 */

// Kanji ranges (+ iteration marks) used to detect the shorthand base run.
const KANJI = '\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uF900-\\uFAFF\\u3005\\u3007\\u303B'

// Bouten (圏点): double angle brackets 《《…》》 → <em class="bouten">…</em>.
// Parsed BEFORE the ruby regex so 《《…》》 is never mis-consumed as a ruby annotation.
const BOUTEN_RE = /《《([^《》\n]*)》》/g

// Alternation: pipe form first, then shorthand. They start with disjoint characters
// (a pipe vs. a kanji), so there is no ambiguity between the two branches.
const RUBY_RE = new RegExp(
  `[|｜]([^|｜《》\\n]*)《([^《》\\n]+)》` + '|' + `([${KANJI}]+)《([^《》\\n]+)》`,
  'g',
)

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderRuby(text: string): string {
  const escaped = escapeHtml(text)

  // Step 1: Convert 《《…》》 to bouten BEFORE ruby parsing so the double-bracket
  // pattern is never mis-consumed as a single-bracket ruby annotation.
  const withBouten = escaped.replace(
    BOUTEN_RE,
    (_match, content: string) => `<em class="bouten">${content}</em>`,
  )

  // Step 2: Convert remaining 《…》 ruby notation.
  const withRuby = withBouten.replace(
    RUBY_RE,
    (_match, pipeBase: string | undefined, pipeRt: string | undefined, shortBase, shortRt) => {
      if (pipeRt !== undefined) {
        // Pipe form — base may legitimately be empty (e.g. `｜《…》`).
        return `<ruby>${pipeBase ?? ''}<rt>${pipeRt}</rt></ruby>`
      }
      return `<ruby>${shortBase}<rt>${shortRt}</rt></ruby>`
    },
  )

  return withRuby.replace(/\n/g, '<br>')
}
