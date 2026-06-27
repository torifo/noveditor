import type { ExportTarget } from './profiles'

/**
 * One episode's content in INTERNAL notation, ready to be converted for a posting site.
 * Novel-common notes are merged with the episode's own (matching the preview order).
 */
export interface EpisodeExportInput {
  novelForeNote: string
  episodeForeNote: string
  body: string
  episodeAfterNote: string
  novelAfterNote: string
}

/**
 * The converted, site-ready pieces. Posting sites have SEPARATE 前書き／後書き fields, so we keep
 * them apart (the UI offers each as its own copy block). `''` when empty.
 */
export interface EpisodeExportResult {
  /** 前書き（お知らせ）: 小説共通 → この話 の順に結合。 */
  foreNote: string
  /** 本文。 */
  body: string
  /** 後書き（あとがき）: この話 → 小説共通 の順に結合。 */
  afterNote: string
}

/** Trim, drop blanks, convert each, join with a blank line. */
function joinNotes(parts: string[], convert: (t: string) => string): string {
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map(convert)
    .join('\n\n')
}

/**
 * Build a site-ready export for a single 話. Pure — same input always yields the same output, so
 * it's trivially testable and reusable by a future whole-novel / Markdown exporter.
 */
export function buildEpisodeExport(
  target: ExportTarget,
  input: EpisodeExportInput,
): EpisodeExportResult {
  return {
    foreNote: joinNotes([input.novelForeNote, input.episodeForeNote], target.convert),
    body: target.convert(input.body),
    afterNote: joinNotes([input.episodeAfterNote, input.novelAfterNote], target.convert),
  }
}
