import { describe, it, expect } from 'vitest'
import { exportTarget, EXPORT_TARGETS } from './profiles'
import { buildEpisodeExport, type EpisodeExportInput } from './buildExport'

const kakuyomu = exportTarget('kakuyomu')
const narou = exportTarget('narou')
const alpha = exportTarget('alphapolis')

describe('export profiles — convert()', () => {
  it('カクヨム is identity (ルビ・圏点そのまま)', () => {
    const s = '｜漢字《かんじ》の《《強調》》'
    expect(kakuyomu.convert(s)).toBe(s)
  })

  it('なろう: 圏点《《X》》 → 各文字に ・ルビ（|文字《・》）', () => {
    expect(narou.convert('《《強調》》')).toBe('|強《・》|調《・》')
  })

  it('なろう: ルビ（｜漢字《かんじ》）はそのまま', () => {
    expect(narou.convert('｜漢字《かんじ》')).toBe('｜漢字《かんじ》')
  })

  it('なろう: 本文中の圏点だけ変換し、地の文・ルビは保持', () => {
    expect(narou.convert('彼は《《本気》》だった。｜俺《おれ》は。')).toBe(
      '彼は|本《・》|気《・》だった。｜俺《おれ》は。',
    )
  })

  it('なろう: 複数の圏点をすべて変換', () => {
    expect(narou.convert('《《前》》と《《後》》')).toBe('|前《・》と|後《・》')
  })

  it('圏点はコードポイント単位で分解（サロゲートペアを壊さない）', () => {
    expect(narou.convert('《《🎴札》》')).toBe('|🎴《・》|札《・》')
  })

  it('アルファポリスはなろうと同じ変換', () => {
    const s = 'これは《《大事》》だ'
    expect(alpha.convert(s)).toBe(narou.convert(s))
  })

  it('全プロファイルが id/label/hint/convert を持つ', () => {
    for (const t of EXPORT_TARGETS) {
      expect(typeof t.id).toBe('string')
      expect(t.label.length).toBeGreaterThan(0)
      expect(typeof t.convert).toBe('function')
    }
  })
})

describe('buildEpisodeExport', () => {
  const base: EpisodeExportInput = {
    novelForeNote: '',
    episodeForeNote: '',
    body: '本文です。',
    episodeAfterNote: '',
    novelAfterNote: '',
  }

  it('注記が空なら foreNote/afterNote は空', () => {
    const r = buildEpisodeExport(kakuyomu, base)
    expect(r.foreNote).toBe('')
    expect(r.afterNote).toBe('')
    expect(r.body).toBe('本文です。')
  })

  it('前書きは 小説共通→この話 の順、後書きは この話→小説共通 の順で結合', () => {
    const r = buildEpisodeExport(kakuyomu, {
      novelForeNote: 'N前',
      episodeForeNote: 'E前',
      body: '本文',
      episodeAfterNote: 'E後',
      novelAfterNote: 'N後',
    })
    expect(r.foreNote).toBe('N前\n\nE前')
    expect(r.afterNote).toBe('E後\n\nN後')
  })

  it('空白のみの注記はスキップ', () => {
    const r = buildEpisodeExport(kakuyomu, { ...base, episodeForeNote: '   ', novelForeNote: 'お知らせ' })
    expect(r.foreNote).toBe('お知らせ')
  })

  it('なろう向けは本文・注記の圏点も変換', () => {
    const r = buildEpisodeExport(narou, {
      ...base,
      body: '《《強》》',
      episodeAfterNote: '《《謝》》',
    })
    expect(r.body).toBe('|強《・》')
    expect(r.afterNote).toBe('|謝《・》')
  })
})
