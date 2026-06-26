# Android Design — Android ネイティブアダプタ

> 対象: [requirements.md](./requirements.md) の US-001〜008 / FR-A04〜A08 を満たす技術設計。共有ロジックは [../core/design.md](../core/design.md) を参照。
> **設計先行**: Web リリースと並行して確定。core API が Android を詰まらせないことの検証を兼ねる。型名・UI 文言・パッケージ名は「仮」。

## Overview

Android アプリは **Jetpack Compose** で UI を実装し、保存モデル・`countStats`・`ManuscriptRepository` port は core（[../core/](../core/design.md)）を **`androidTarget()`/JVM ターゲット**で再利用する。永続化は端末内ストレージで `ManuscriptRepository` を実装する。Compose はネイティブ IME を標準対応するため、Web で問題になった canvas 描画系の制約は無い（縦書き/ルビも将来 Compose text / 自前レイアウトで対応余地）。

## Architecture

```
noveditor/
├─ core/                          # 共有ロジック（別 spec）。androidTarget()/JVM を追加して再利用
└─ android/                       # Android アプリ（Jetpack Compose）
   └─ src/main/
      ├─ AndroidManifest.xml
      ├─ kotlin/.../MainActivity.kt
      ├─ kotlin/.../ui/EditorScreen.kt      # 編集領域・タイトル・統計
      ├─ kotlin/.../ui/ManuscriptListScreen.kt
      └─ kotlin/.../repository/AndroidManuscriptRepository.kt
```

> core は MVP 時点で `js(IR)` のみ有効。Android 着手時に `androidTarget()`（または `jvm()`）を `core/build.gradle.kts` に追加し、`commonMain` をそのまま再利用する。`android/` は Android Gradle Plugin ＋ Compose を持つ通常の Gradle モジュールとして `settings.gradle.kts` に登録する。

### Layer responsibilities

| 層 | モジュール | 責務 | 禁止事項 |
|---|---|---|---|
| **Core** | `core/` | モデル / `countStats` / `ManuscriptRepository`(port) / 直列化 | DOM・I/O・UI 依存 |
| **Adapter** | `android/` | Compose UI / 端末保存実装 / core 呼び出し | コア外ロジックの抱え込み |

### Components

- **core 再利用 (android)**: `countStats`・モデル・`ManuscriptRepository` 型を commonMain から直接利用。
- **`AndroidManuscriptRepository` (android)**: `ManuscriptRepository`(port) の Android 実体。端末内ストレージに JSON 永続化。
- **Editor UI (android, Compose)**: 編集領域（`BasicTextField`/`TextField`）・タイトル入力・統計表示・一覧・新規/切替/削除・明示保存。
- **保存制御**: 本文/タイトル編集の debounce で自動保存（`Repository.save`）。

## Data Flow

入力 → 統計（`countStats`）、保存（`Repository.save`、`updatedAt=now` 注入）、起動→ `list()`→ `load(最新)`、削除→ `delete(id)` は Web（[../web/design.md](../web/design.md)）と同型。差異は **保存先が端末内ストレージ**である点のみ。`id`/`createdAt`/`updatedAt` は Android アダプタが採番（`UUID` / `System.currentTimeMillis()`）して core モデルへ注入する。

## 永続化方式（候補・実装時に確定）

`ManuscriptRepository` の Android 実装は以下から選ぶ。MVP は **Web の LocalStorage 設計と対称な「ファイル＋index」** を推奨（最小・移植容易・core serializer 共有）。

| 方式 | 概要 | 備考 |
|---|---|---|
| **ファイル＋index（推奨・MVP）** | `filesDir` に `manuscript-<id>.json`（本体）＋ `index.json`（Summary 配列）。core serializer で JSON 化 | Web のキー設計と対称。保存順序・自己修復ロジックも Web と同型に移植 |
| DataStore | Preferences/Proto DataStore に保存 | 小規模に手軽だが一覧クエリは自前 |
| Room | エンティティ＋DAO で一覧クエリが堅牢 | KSP/codegen の重さ。原稿が増える v1.x で再検討 |

> 推奨方式では、Web と同じ「本体を先に書き→index 更新」「削除は本体→index 除去」「起動時に index↔本体を突合し自己修復」を踏襲する。

## Error Handling

| ケース | 戦略 |
|---|---|
| 端末ストレージ保存失敗（容量・権限） | 例外捕捉 → UI に失敗通知、編集中バッファは保持（US-003 AC） |
| 破損 JSON / スキーマ不一致 | 当該原稿を読み飛ばし、一覧から除外候補としてログ。アプリは起動継続 |
| index と本体の不整合 | 起動時突合で自己修復（本体欠落 index 除外・孤立本体読み飛ばし） |
| 保存データ皆無 | 空の初期状態（US-004 AC） |

## Security / Privacy Considerations

- 端末内完結。送信・外部保存なし。保存先はアプリ専用ストレージ（`filesDir` 等）。
- 直列化は core の kotlinx.serialization 由来の型安全な経路に限定。

## Testing Strategy

- **Unit (commonTest)**: core の `countStats`・直列化は Web と共有のテストで担保。
- **Unit (android)**: `AndroidManuscriptRepository` の save→load→list→delete ラウンドトリップ＋不整合自己修復（Robolectric / 一時ディレクトリ）。
- **UI/E2E（手動 or Compose test）**: 書く→保存→再起動で復元、複数原稿の作成・切替・削除、オフライン動作。

## Build / Toolchain

- `core/build.gradle.kts` に `androidTarget()`（または `jvm()`）を追加し commonMain を再利用。
- `android/` は Android Gradle Plugin ＋ Jetpack Compose。`settings.gradle.kts` に登録。
- 署名・配信（APK / ストア）は実装時に確定（仮）。

## Requirements トレーサビリティ

| 要件 | カバー箇所 |
|---|---|
| US-001 / FR-A05 | Compose Editor（ネイティブ IME） |
| US-002 / core FR-001 | `countStats`（core 再利用）/ 統計表示 |
| US-003 / FR-A04,A07 ＋ core FR-002,003 | 保存フロー（自動＋明示）/ 端末ストレージ実装 / port / 直列化 |
| US-004 / US-005 | 起動・読み出し・切替（既定は updatedAt 最大） |
| US-006 / FR-A06 | ネイティブオフライン / APK・ストア配信 |
| US-007 / FR-A05 | タイトル入力欄 |
| US-008 / FR-A08 | 削除操作 / Repository.delete |
| core API 適合性検証 | port・モデルが端末ストレージ実装で無理なく充足（設計先行の目的） |
