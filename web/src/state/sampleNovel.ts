import { Episode, Novel } from 'noveditor-core'
import type { NovelRepository } from '../repository/NovelRepository'

/**
 * A built-in "使い方" (how-to) novel, seeded once and pinned to the bottom of the list via a
 * fixed old timestamp. It demonstrates the editor's features in real content (ルビ・圏点・
 * お知らせ/あとがき・連載) and is protected from deletion so the guide is always available.
 *
 * Identified by a reserved id; the app hides delete affordances for it and the repository keeps
 * it present (re-seeded only when absent, so user edits to it persist).
 */
export const SAMPLE_NOVEL_ID = 'sample-guide'

const EP_INTRO = 'sample-guide-1-intro'
const EP_NOTATION = 'sample-guide-2-notation'
const EP_SERIAL = 'sample-guide-3-serial'

export const SAMPLE_EPISODE_IDS: readonly string[] = [EP_INTRO, EP_NOTATION, EP_SERIAL]

export function isSampleNovel(novelId: string): boolean {
  return novelId === SAMPLE_NOVEL_ID
}

export function isSampleEpisode(episodeId: string): boolean {
  return SAMPLE_EPISODE_IDS.includes(episodeId)
}

// 2020-01-01T00:00:00Z. A fixed past time so the guide sorts as the oldest novel even when it is
// first seeded for a user whose own novels already exist.
const TS = 1577836800000

function buildSample(): { novel: Novel; episodes: Episode[] } {
  const novel = new Novel(
    SAMPLE_NOVEL_ID,
    'ノヴェディタの使い方',
    'このアプリでできることを、実例で案内するサンプルです。',
    [EP_INTRO, EP_NOTATION, EP_SERIAL],
    TS,
    TS,
    'これは使い方サンプルです。自由に開いて、記法やプレビューを試せます。（この小説は削除できません）',
    'あなたの小説は、左上の「＋ 新規小説」から始められます。よい執筆を。',
  )

  const intro = new Episode(
    EP_INTRO,
    SAMPLE_NOVEL_ID,
    '1. まず書いてみる',
    'ようこそ。ここに文章を入力すると、すぐに画面へ反映され、自動で保存されます。\n\n' +
      '左の一覧で、小説や話（エピソード）を切り替えられます。文字数と行数は、画面下のステータスバーに表示されます。\n\n' +
      '上部の「プレビュー」に切り替えると、清書された見た目を確認できます。',
    TS,
    TS,
  )

  const notation = new Episode(
    EP_NOTATION,
    SAMPLE_NOVEL_ID,
    '2. ルビと圏点',
    '漢字の読みがなは、縦棒とふたつの山かっこで振れます。\n' +
      '例：｜漢字《かんじ》、｜星月夜《ほしづきよ》。\n\n' +
      '強調したいところには、二重の山かっこで圏点を打てます。\n' +
      '例：ここが《《大切》》な場面です。\n\n' +
      '上の「プレビュー」に切り替えると、ルビと圏点が反映された見た目になります。',
    TS,
    TS,
    'この話では、本文で使える記法を紹介します。',
    '記法はプレビューで確かめながら使うのがおすすめです。',
  )

  const serial = new Episode(
    EP_SERIAL,
    SAMPLE_NOVEL_ID,
    '3. 連載とエクスポート',
    'ひとつの小説に話を足していけば、そのまま連載になります。一覧の「＋」から話を追加できます。一話完結なら、話はひとつのままでかまいません。\n\n' +
      '書き上げたら、エクスポート（上部の ↥ ボタン、ショートカット ⌘E / Ctrl+E）から、小説投稿サイトの記法へ変換してコピー・保存できます（カクヨム・小説家になろう・アルファポリス）。\n\n' +
      'お知らせ（前書き）とあとがき（後書き）は、話ごとにも、小説共通にも付けられます。空のときは自動で隠れます。',
    TS,
    TS,
  )

  return { novel, episodes: [intro, notation, serial] }
}

/**
 * Seed the built-in guide novel once. No-op when it already exists, so any edits the user makes
 * to it survive; it is only (re)created when missing (e.g. fresh storage). Best-effort: callers
 * should not block startup on failure.
 */
export async function seedSampleNovel(repo: NovelRepository): Promise<void> {
  const existing = await repo.loadNovel(SAMPLE_NOVEL_ID)
  if (existing) return
  const { novel, episodes } = buildSample()
  for (const ep of episodes) await repo.saveEpisode(ep)
  await repo.saveNovel(novel)
}
