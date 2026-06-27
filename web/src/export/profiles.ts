/**
 * Export notation profiles: convert noveditor's INTERNAL notation into each posting site's notation.
 *
 * Internal notation (same as the preview / `renderRuby`):
 *   - ルビ:   `｜漢字《かんじ》`   (a 親文字 run, optionally fenced by ｜, then 《ふりがな》)
 *   - 圏点:   `《《強調》》`        (double angle brackets)
 *
 * Site differences (verified 2026-06; see docs spec sources):
 *   - カクヨム:      ルビ・圏点とも内部記法と同一 → そのまま（恒等変換）。
 *   - なろう/アルファ: 圏点ネイティブ非対応 → 各文字に ・ ルビを付ける代用（`|文字《・》`）。ルビは縦棒OKでそのまま。
 *
 * Designed to extend: add a profile (e.g. 'markdown' / 'plain') with its own `convert`.
 */
export type ExportTargetId = 'kakuyomu' | 'narou' | 'alphapolis'

export interface ExportTarget {
  id: ExportTargetId
  label: string
  /** Short note on how this site consumes the text (shown in the export UI). */
  hint: string
  /** Convert ONE block (body or a note) from internal notation to this site's notation. */
  convert: (text: string) => string
}

// 圏点 《《X》》 を捕捉（最短一致・閉じ »» まで）。ルビの単一《》には一致しない。
const BOUTEN = /《《([^》]+)》》/g

/** 圏点 → なろう/アルファ式: 中身を1コードポイントずつ `|文字《・》` に展開（傍点ルビ代用）。 */
function boutenToDotRuby(text: string): string {
  return text.replace(BOUTEN, (_match, inner: string) =>
    [...inner].map((ch) => `|${ch}《・》`).join(''),
  )
}

/** カクヨムは内部記法と同一なので恒等変換。 */
function identity(text: string): string {
  return text
}

export const EXPORT_TARGETS: readonly ExportTarget[] = [
  {
    id: 'kakuyomu',
    label: 'カクヨム',
    hint: '本文・前書き・後書きを各欄に貼り付け（記法はそのまま）',
    convert: identity,
  },
  {
    id: 'narou',
    label: 'なろう',
    hint: '1話ずつ本文を入力／.txtアップロード。圏点は ・ルビ に変換',
    convert: boutenToDotRuby,
  },
  {
    id: 'alphapolis',
    label: 'アルファポリス',
    hint: '1話ずつ本文を入力／.txtアップロード。圏点は ・ルビ に変換',
    convert: boutenToDotRuby,
  },
]

export function exportTarget(id: ExportTargetId): ExportTarget {
  return EXPORT_TARGETS.find((t) => t.id === id) ?? EXPORT_TARGETS[0]
}
