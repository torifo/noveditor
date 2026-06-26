/**
 * Ruby (ルビ / 振り仮名) renderer — isolated, side-effect-free string → HTML.
 *
 * This seeds a future 縦書き (vertical) preview, so it is kept as a small pure util the Preview
 * component can `{@html}`. SAFETY: the input is HTML-escaped *first*, so base/rt content can never
 * inject markup; only the `<ruby>/<rt>/<br>` tags we emit are real HTML.
 *
 * Supported notation (青空文庫-style):
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
 *   - Ruby groups never span a newline (the inner classes exclude `\n`).
 *   - Newlines are preserved as `<br>`.
 */

// Kanji ranges (+ iteration marks) used to detect the shorthand base run.
const KANJI = '\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uF900-\\uFAFF\\u3005\\u3007\\u303B'

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
  const withRuby = escaped.replace(
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
