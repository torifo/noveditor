# Novel→Episode Design — 連載（小説→話）構造

> 対象: [requirements.md](./requirements.md)。core モデル/port と web UI・移行の設計。
> 命名: コンテナは **`Novel`（小説）**。汎用語 `Work`/「作品」は使わない。
> 影響: [../core/](../core/design.md)（モデル・port 拡張）／ [../web/](../web/design.md)（2階層 UI・移行）。型名は「仮」。

## Overview

`Episode` を本文の単位（現行 `Manuscript` の一般化）とし、`Novel` が順序付きの `Episode` を束ねる。一話完結は「話が1つの小説」として同一モデルで表現する。core はモデルと port のみを持ち、永続化と UI はアダプタが担う（3層分離は不変）。

## Data Models（core / commonMain・仮）

```kotlin
@Serializable @JvmInline value class NovelId(val value: String)
@Serializable @JvmInline value class EpisodeId(val value: String)

@Serializable
data class Novel(
    val id: NovelId,
    val title: String,
    val synopsis: String = "",          // あらすじ（任意）
    val episodeOrder: List<EpisodeId>,  // 話の並び（順序の源泉）
    val createdAt: Long,
    val updatedAt: Long,
)

@Serializable
data class Episode(
    val id: EpisodeId,
    val novelId: NovelId,
    val title: String,                  // 話タイトル
    val body: String,
    val createdAt: Long,
    val updatedAt: Long,
)

// 一覧用の軽量メタ（本文を載せない）
@Serializable data class NovelSummary(val id: NovelId, val title: String, val episodeCount: Int, val updatedAt: Long)
@Serializable data class EpisodeSummary(val id: EpisodeId, val title: String, val updatedAt: Long)
```

> **順序の源泉は `Novel.episodeOrder`**（`Episode` に order を持たせず、並びは小説が一元管理）。並べ替えが「小説の更新」1回で済み、整合性が崩れにくい。
> **`Manuscript` → `Episode` の一般化**: 現行 core の `Manuscript`（id/title/body/createdAt/updatedAt）に `novelId` を足した形。`countStats` 等は本文(String)に対して不変。

## Core API（port・仮）

```kotlin
interface NovelRepository {
    suspend fun listNovels(): List<NovelSummary>
    suspend fun loadNovel(id: NovelId): Novel?
    suspend fun saveNovel(novel: Novel)                  // メタ＋episodeOrder を保存
    suspend fun deleteNovel(id: NovelId)                 // 配下の話も削除

    suspend fun listEpisodes(novelId: NovelId): List<EpisodeSummary> // episodeOrder 準拠で返す
    suspend fun loadEpisode(id: EpisodeId): Episode?
    suspend fun saveEpisode(episode: Episode)
    suspend fun deleteEpisode(id: EpisodeId)             // 親 Novel.episodeOrder からも除去
}
```

> 既存の `ManuscriptRepository` は本機能導入時に `NovelRepository` へ置換（または `Episode` 単位の薄い互換ラッパを残す）。id 採番・時刻はアダプタ注入のまま。

## Web Adapter Design

### ストレージ（LocalStorage キー設計・案）
- `noveditor:novels`（`NovelSummary[]` の index）
- `noveditor:novel:<novelId>`（`Novel` 本体＝メタ＋episodeOrder）
- `noveditor:episode:<episodeId>`（`Episode` 本体）
- 整合性は現行と同型（本体先書き→index/Novel 更新、削除は本体→親順序除去、起動時突合で自己修復）。

### UI（2階層サイドバー）
- サイドバー: **小説リスト**（タイトル＋話数＋更新時刻、アクティブ＝紫）。小説を開くと配下に**話リスト**（話タイトル＋更新時刻）を展開（折り畳み可）。
- 操作: ＋新規小説 / 小説内に ＋新規話 / 話のドラッグ並べ替え / 小説・話の削除（Undoトースト流用）。
- **単発最適化（US-N05）**: 話が1つの小説は話リストを畳み、小説クリックで直接その話を編集領域へ。2話目追加で話リストを展開。
- エディタ右上に「小説名 › 話タイトル」のパンくず（現在地表示）。エディタ本体・統計・自動保存・ルビプレビューは現行を流用。

### データフロー
起動 → `listNovels()` → 既定で updatedAt 最大の小説 → その小説の `listEpisodes()` → 既定話（最新 or 先頭）を `loadEpisode()`。切替時は現話を自動保存してから load。

## 移行（FR-NE04）
- 起動時、旧 `noveditor:index` / `noveditor:manuscript:*` を検出したら一度だけ migrate:
  - 各旧原稿 → `Episode`（id/title/body/createdAt/updatedAt 保持、新規 `novelId` を採番）。
  - その Episode 1つを持つ `Novel`（title=旧原稿タイトル、episodeOrder=[episodeId]）を生成。
  - 旧キーは移行完了フラグ後に保持 or 削除（安全のため一定期間保持を推奨）。
- 冪等性: 移行済みフラグ（`noveditor:migrated:novel-episodes`）で二重実行を防ぐ。

## Error Handling
- novel/episode/index の不整合 → 起動時突合で自己修復（本体欠落の参照を除外、孤立本体を読み飛ばし）。
- 移行失敗 → 旧データを破棄せず、失敗を通知してフラット表示にフォールバック。

## Testing Strategy
- **core (commonTest)**: モデル直列化ラウンドトリップ、`episodeOrder` を含む Novel の整合。
- **web (Vitest)**: NovelRepository 実装の小説/話 CRUD＋並べ替え＋自己修復、旧→新スキーマ移行（冪等）。
- **手動**: 連載（複数話）作成・並べ替え・切替、単発小説の最小化、既存原稿の移行。

## Requirements トレーサビリティ
| 要件 | カバー箇所 |
|---|---|
| US-N01 / FR-NE01,02 | Novel モデル / NovelRepository |
| US-N02 | episodeOrder 更新 / reorder |
| US-N03 | Episode 編集（現行エディタ流用） |
| US-N04 | 2階層 UI / データフロー |
| US-N05 | 単発最適化（話1つで階層最小化） |
| US-N06 / FR-NE04 | 移行（旧原稿→1話小説・冪等） |
| 外部連携（縦書き/書籍化） | 小説単位の結合は [tatemd](https://github.com/torifonium/tatemd) 連携（ROADMAP） |
