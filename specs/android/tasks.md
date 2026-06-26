# Android Tasks — Android ネイティブアダプタ

> 対象: [requirements.md](./requirements.md) / [design.md](./design.md)
> 規約: 1 タスク = 1 コミット相当。コミットに Claude/Anthropic 由来の署名は入れない。型名・UI 文言・パッケージ名は「仮」。
> **着手時期**: 最初のリリース（Web/PWA）後。**本 spec の設計（requirements/design）は Web と並行で先行確定**し、core API の Android 適合を保証する。
> **前提**: core（[../core/tasks.md](../core/tasks.md)）の Wave C1〜C2 完了。

## Implementation Plan

### Wave A1（core への Android ターゲット追加・基盤）

- [ ] **Task A1.1**: core に Android ターゲット追加
  - What: `core/build.gradle.kts` に `androidTarget()`（または `jvm()`）を追加し、`commonMain` を再利用可能にする。既存 commonTest が両ターゲットで緑
  - Files: `core/build.gradle.kts`
  - Done when: `./gradlew :core:compileKotlin*` が Android/JVM ターゲット込みで成功、commonTest 緑
  - Depends on: Task C2.3（port まで確定）

- [ ] **Task A1.2**: android アプリモジュール雛形
  - What: `android/` に Android Gradle Plugin ＋ Jetpack Compose のアプリモジュールを作成し、core を依存に追加。空の `MainActivity` ＋ 最小 Compose 画面
  - Files: `android/build.gradle.kts`, `android/src/main/AndroidManifest.xml`, `android/src/main/kotlin/.../MainActivity.kt`, `settings.gradle.kts` 更新
  - Done when: エミュレータ/実機で空アプリが起動し、core の `countStats` を呼べる
  - Depends on: Task A1.1

### Wave A2（保存・エディタ）

- [ ] **Task A2.1**: 端末内ストレージ Repository 実装（削除・整合性込み）
  - What: `AndroidManuscriptRepository`（推奨: `filesDir` の `manuscript-<id>.json` ＋ `index.json`、core serializer で JSON 化）。本体先書き→index 更新、削除は本体→index 除去、起動時突合で自己修復
  - Files: `android/src/main/kotlin/.../repository/AndroidManuscriptRepository.kt`, テスト
  - Done when: save→load→list→delete ラウンドトリップ＋自己修復のテストが緑（Robolectric/一時ディレクトリ）（FR-A04・FR-A08）
  - Depends on: Task A1.2

- [ ] **Task A2.2**: 最小エディタ UI（Compose・本文＋タイトル）
  - What: Compose 編集領域（`BasicTextField`/`TextField`）＋タイトル入力＋文字数/行数表示。IME 未確定は集計対象外。統計は core `countStats`。新規作成時は id/createdAt を採番注入（`UUID`/`System.currentTimeMillis()`）（US-001/002/007・FR-A05）
  - Files: `android/src/main/kotlin/.../ui/EditorScreen.kt`
  - Done when: 入力で統計がリアルタイム更新、IME 変換中は未確定が加算されない、タイトル編集が保存対象に入る
  - Depends on: Task A1.2

- [ ] **Task A2.3**: 原稿一覧・新規作成・切替・削除
  - What: 一覧（タイトル＋更新時刻）、新規作成、切替時に自動保存して復元、削除（確認 UI・仮）。起動時は updatedAt 最大を既定表示（US-004/005/008）
  - Files: `android/src/main/kotlin/.../ui/ManuscriptListScreen.kt`, 状態管理（ViewModel 等）
  - Done when: 複数原稿の作成・切替・復元・削除が成立、起動時に最新原稿が開く
  - Depends on: Task A2.1, A2.2

- [ ] **Task A2.4**: 自動保存（debounce）＋明示保存
  - What: 本文・タイトル編集の無操作時間後に `save` を呼ぶ自動保存と明示保存を同一経路で実装。`updatedAt=now` 注入。保存失敗は通知し編集内容を破棄しない（US-003・FR-A07）
  - Files: `android/src/main/kotlin/.../ui/EditorScreen.kt`, 保存制御
  - Done when: 編集停止後に自動保存され、明示保存も即時に効く。保存失敗が通知される
  - Depends on: Task A2.1, A2.2

### Wave A3（配信 ＆ 通し検証）

- [ ] **Task A3.1**: APK ビルド・インストール
  - What: リリース/デバッグ APK ビルド、署名（仮）、エミュレータ/実機インストール。配信形態（ストア）は仮
  - Files: `android/build.gradle.kts`（signingConfig 等・仮）
  - Done when: 端末にインストールでき、オフラインで書く→保存→再起動復元が成立（US-006・FR-A06）
  - Depends on: Task A2.3, A2.4

- [ ] **Task A3.2**: end-to-end 通し検証
  - What: 書く→保存→再起動で復元、複数原稿切替・削除、オフライン動作を手動シナリオで確認
  - Files: `specs/android/` に検証メモ追記（任意）
  - Done when: Android 版の MVP 体験（書く→保存→開く・複数原稿・オフライン）が成立
  - Depends on: Task A3.1

## Progress
- Total: 7 tasks | Completed: 0 | In Progress: 0
- Wave A1: A1.1, A1.2 ／ Wave A2: A2.1–A2.4 ／ Wave A3: A3.1, A3.2
- 前提: [../core/tasks.md](../core/tasks.md)。設計は Web と並行先行、実装は Web リリース後。
