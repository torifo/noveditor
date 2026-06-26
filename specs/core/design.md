# Core Design — 共有ロジック（Kotlin / KMP）

> 対象: [requirements.md](./requirements.md) の FR-001/002/003/C04 ＋ NFR を満たす技術設計。
> 型名・パッケージ名は「仮」（最終決定はユーザー主導）。

## Overview

`core/` は Gradle マルチモジュールの一員として、保存モデル・文字統計・保存先 port（interface）・直列化を提供し、ブラウザ API や DOM を一切参照しない。Web 消費のため `js(IR){ browser() }` の **ライブラリ出力＋TS 型定義生成**で npm/ESM パッケージ化する。将来 Android が加わる際は `androidTarget()`/JVM ターゲットを追加し、同じ `commonMain` を再利用する。

## Architecture

```
noveditor/
├─ settings.gradle.kts            # core を登録（各アダプタは各自のツールチェーンで管理）
├─ build.gradle.kts               # 共通プラグイン束ね
├─ gradle/libs.versions.toml      # バージョンカタログ
├─ gradlew, gradle/wrapper/       # Wrapper 同梱（gradle 未インストール）
└─ core/
   ├─ build.gradle.kts            # kotlin multiplatform + serialization、js library 出力
   └─ src/
      ├─ commonMain/kotlin/       # モデル・countStats・Repository port（@JsExport）
      └─ commonTest/kotlin/       # 単体テスト（UI 非依存）
```

### Layer responsibilities

| 層 | 責務 | 禁止事項 |
|---|---|---|
| **Core** (`core/`) | 保存モデル / `countStats` / `ManuscriptRepository`(port) / 直列化 / JS 出力 | DOM・ブラウザ API・I/O・UI フレームワークへの依存、時刻・乱数源の保持 |

### Components

- **`countStats` (core)**: 本文文字列 → `DocumentStats`。純粋関数。
- **`Manuscript` / `ManuscriptSummary` (core)**: 原稿モデルと一覧用メタ。
- **`ManuscriptRepository` (core, interface)**: save / load / list / delete の port。
- **JS 出力**: 公開 API を `@JsExport` し、`.mjs` ＋ `.d.mts` を生成（アダプタが npm 消費）。

## Data Models（commonMain・仮）

```kotlin
// パッケージ名は仮: dev.noveditor.core.model
@Serializable
@JvmInline
value class ManuscriptId(val value: String)

@Serializable
data class Manuscript(
    val id: ManuscriptId,
    val title: String,          // 仮: UI 文言・既定タイトルはアダプタ/ユーザー決定
    val body: String,
    val createdAt: Long,        // epoch millis（アダプタ注入）
    val updatedAt: Long,        // epoch millis（アダプタ注入）
)

// 一覧表示用の軽量メタ（本文を載せない）
@Serializable
data class ManuscriptSummary(
    val id: ManuscriptId,
    val title: String,
    val updatedAt: Long,
)

data class DocumentStats(
    val charCount: Int,             // コードポイント基準・総文字数
    val charCountNoWhitespace: Int, // 空白・改行を除く
    val lineCount: Int,
    val paragraphCount: Int,        // 算出のみ・MVP UI では非表示
)
```

> **id 生成・時刻の供給（純粋性の維持）**: `core` は時刻源・乱数源を持たない。`ManuscriptId` の採番と `createdAt` / `updatedAt` の現在時刻は **アダプタが生成して注入**する（web 例: `crypto.randomUUID()` / `Date.now()`／Android 例: `UUID` / `System.currentTimeMillis()`）。`core` はこれらをフィールド・引数として受け取るのみで、内部で「現在」を参照しない。これにより `countStats`・直列化・モデルが `commonTest` で決定的にテストできる。

## Core API（仮）

```kotlin
// dev.noveditor.core.stats — 純粋関数。コードポイント基準（surrogate pair を 1 文字）
fun countStats(text: String): DocumentStats

// dev.noveditor.core.repository（port）
interface ManuscriptRepository {
    suspend fun list(): List<ManuscriptSummary>
    suspend fun load(id: ManuscriptId): Manuscript?
    suspend fun save(manuscript: Manuscript)
    suspend fun delete(id: ManuscriptId)
}
```

### countStats アルゴリズム方針

- 文字数: `String` を走査しサロゲートペアを 1 とカウント（`Char` 単位反復は使わない）。
- 空白除外: Unicode 空白 + 改行（`\n` / `\r`）を除外。判定集合は実装時に定数化。
- 行数: 改行区切り。空本文は 0。末尾改行の扱いは「改行で区切られた行の数」を基準にテストで固定。
- 段落数: 1 つ以上の空行で区切られたブロック数（v1 のセリフ比率等の布石・MVP UI 非表示）。

## Build / Toolchain

- Gradle Wrapper 同梱（gradle 未インストール環境のため必須）。
- `libs.versions.toml` に Kotlin / kotlinx-serialization / test ライブラリのバージョンを集約。
- `core/` は `kotlin("multiplatform")` ＋ `kotlin("plugin.serialization")`。`js(IR){ browser() }` で `binaries.library()` ＋ `generateTypeScriptDefinitions()` ＋ `useEsModules()` を有効化し、公開 API に `@JsExport` を付与して npm/ESM ＋ `.d.mts` を出力。
- commonTest は JVM でも実行可にして高速化を検討。
- **将来 Android**: `androidTarget()`（または `jvm()`）を追加して `commonMain` を再利用（[../android/design.md](../android/design.md)）。

## Security / Privacy Considerations

- core は I/O を持たず、送信・外部保存をしない。
- 直列化は kotlinx.serialization の型安全な経路に限定（任意コード実行経路を作らない）。

## Testing Strategy

- **Unit (commonTest)**: `countStats` を中心に、空文字 / 半角 / 全角 / 改行のみ / サロゲートペア（絵文字・異体字）/ 混在 / 段落区切り、を表形式ケースで検証（FR-001・NFR 正確性）。モデルの直列化ラウンドトリップ（FR-002）。
- **JS 出力の消費確認**: 生成された `.mjs` ＋ `.d.mts` を最小 TS から型付き import できることを確認（FR-C04・[../web/](../web/design.md) Task と接続）。

## Requirements トレーサビリティ

| 要件 | カバー箇所 |
|---|---|
| FR-001 | `countStats` / アルゴリズム方針 |
| FR-002 | Data Models / 直列化 |
| FR-003 | `ManuscriptRepository`(port) |
| FR-C04 | JS ライブラリ出力（@JsExport / .d.mts） |
| NFR 正確性・テスト容易性・副作用源注入 | 純粋性（時刻・id はアダプタ注入）+ commonTest 戦略 |
