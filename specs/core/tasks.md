# Core Tasks — 共有ロジック（Kotlin / KMP）

> 対象: [requirements.md](./requirements.md) / [design.md](./design.md)
> 規約: 1 タスク = 1 コミット相当。コミットに Claude/Anthropic 由来の署名は入れない。型名・パッケージ名は「仮」。
> **位置づけ**: core は web・android 双方が依存する基盤。アダプタ spec（[../web/tasks.md](../web/tasks.md) / [../android/tasks.md](../android/tasks.md)）の着手前に C1〜C2 を完了させる。

## Implementation Plan

### Wave C1（リポジトリ基盤・依存なし）

- [ ] **Task C1.1**: リポジトリ基盤の初期化
  - What: `git init`、`.gitignore`（Gradle/Kotlin/JS/IDE ＋ Node: `node_modules`/`dist`/`.vite`）、Gradle Wrapper 同梱、`settings.gradle.kts`（core 登録）、ルート `build.gradle.kts`、`gradle/libs.versions.toml`（Kotlin・kotlinx-serialization・test）
  - Files: `settings.gradle.kts`, `build.gradle.kts`, `gradle/libs.versions.toml`, `gradlew`, `gradle/wrapper/*`, `.gitignore`
  - Done when: `./gradlew tasks` が成功する（空構成でビルドが通る）
  - Depends on: none

- [ ] **Task C1.2**: core モジュールの雛形
  - What: `core/build.gradle.kts`（kotlin multiplatform + serialization、`js(IR){ browser() }` ＋ `binaries.library()` ＋ `generateTypeScriptDefinitions()` ＋ `useEsModules()`、commonTest 有効）、空パッケージ作成
  - Files: `core/build.gradle.kts`, `core/src/commonMain/kotlin/.gitkeep`, `core/src/commonTest/kotlin/.gitkeep`
  - Done when: `./gradlew :core:compileKotlin*`（or allTests の空実行）が成功
  - Depends on: Task C1.1（settings 登録）

### Wave C2（core 実装・UI なしで完結）

- [ ] **Task C2.1**: 保存モデルと直列化
  - What: `Manuscript` / `ManuscriptId` / `ManuscriptSummary` / `DocumentStats` 定義、`@Serializable` 付与
  - Files: `core/src/commonMain/kotlin/.../model/*.kt`
  - Done when: 直列化ラウンドトリップのテストが緑（FR-002）
  - Depends on: Task C1.2

- [ ] **Task C2.2**: `countStats` 純粋関数
  - What: コードポイント基準の総文字数 / 空白除外 / 行数 / 段落数。サロゲートペアを 1 文字でカウント
  - Files: `core/src/commonMain/kotlin/.../stats/CountStats.kt`
  - Done when: 表形式テスト（空 / 半角 / 全角 / 改行のみ / 絵文字・異体字 / 混在 / 段落）が緑（FR-001・NFR 正確性）
  - Depends on: Task C2.1（DocumentStats 利用）

- [ ] **Task C2.3**: `ManuscriptRepository` port
  - What: list / load / save / delete の `suspend` interface を core に定義
  - Files: `core/src/commonMain/kotlin/.../repository/ManuscriptRepository.kt`
  - Done when: コンパイル成功＋ KDoc に各契約（戻り値・null 条件）を明記（FR-003）
  - Depends on: Task C2.1

- [ ] **Task C2.4**: core を JS ライブラリとして出力（web 消費用）
  - What: 公開 API（`countStats`・モデル・`ManuscriptRepository` 型）に `@JsExport` を付与し、`js` ライブラリ＋ `.d.mts`（TS 型定義）を出力。アダプタからローカルリンクで import 可能にする
  - Files: `core/build.gradle.kts`, `core/src/commonMain/kotlin/.../*`（@JsExport 付与）
  - Done when: `./gradlew :core:jsBrowserProductionLibraryDistribution`（相当）で `.mjs` ＋ `.d.mts` が生成され、最小 TS から型付き import できる
  - Depends on: Task C2.1, C2.2, C2.3

## Progress
- Total: 6 tasks | Completed: 0 | In Progress: 0
- Wave C1: C1.1, C1.2 ／ Wave C2: C2.1, C2.2, C2.3, C2.4
- 後続: [../web/tasks.md](../web/tasks.md)（C2.4 出力に依存）／ [../android/tasks.md](../android/tasks.md)（commonMain 再利用）
