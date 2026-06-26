# Web Tasks — Web / PWA アダプタ

> 対象: [requirements.md](./requirements.md) / [design.md](./design.md)
> 規約: 1 タスク = 1 コミット相当。コミットに Claude/Anthropic 由来の署名は入れない。型名・UI 文言・PWA 名称は「仮」。
> **前提**: core（[../core/tasks.md](../core/tasks.md)）の Wave C1〜C2 完了（特に Task C2.4 の js ライブラリ＋ `.d.mts` 出力）。
> **技術スタック（確定）**: TypeScript + Vite + Svelte 5 / PWA は vite-plugin-pwa。

## Implementation Plan

### Wave W1（web 基盤・core 消費）

- [ ] **Task W1.1**: web プロジェクト雛形（Vite + TS + Svelte）
  - What: `web/` に Vite + TypeScript + Svelte 5 プロジェクトを作成し、core（Task C2.4 出力）をローカルリンクで依存に追加。起動エントリと最小ページ（文言は仮）
  - Files: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/src/main.ts`, `web/src/App.svelte`, `web/index.html`
  - Done when: `vite dev` で空ページが表示され、core の `countStats` を型付きで import・呼び出しできる
  - Depends on: Task C2.4

### Wave W2（保存・エディタ）

- [ ] **Task W2.1**: LocalStorage Repository 実装（削除・整合性込み）
  - What: `LocalStorageManuscriptRepository`（キー `noveditor:manuscript:<id>` / `noveditor:index`、core serializer で JSON 化、例外捕捉）。`save` は本文先書き→index 更新の順、`delete` は本文削除→index 除去の順。起動時に index↔本文を突合し自己修復（本文欠落 index 除外・孤立本文読み飛ばし）
  - Files: `web/src/repository/LocalStorageManuscriptRepository.ts`, `web/src/repository/*.test.ts`
  - Done when: save→load→list→delete ラウンドトリップ＋不整合自己修復のテストが緑（Vitest）（FR-004・FR-008・US-003/004/005/008）
  - Depends on: Task W1.1（core 型は C2.4 経由）

- [ ] **Task W2.2**: 最小エディタ UI（本文＋タイトル）
  - What: Svelte 編集領域（textarea 起点）＋タイトル入力欄＋文字数/行数表示。`compositionstart/end` 監視で IME 未確定を集計対象外。統計は core の `countStats` を呼ぶ。新規作成時は **アダプタが id/createdAt を採番**（`crypto.randomUUID()`/`Date.now()`）（US-001/002/007・FR-005）
  - Files: `web/src/editor/Editor.svelte`, `web/src/editor/*.ts`
  - Done when: 入力で統計がリアルタイム更新、IME 変換中は未確定が加算されない、タイトル編集が保存対象に入る
  - Depends on: Task W1.1

- [ ] **Task W2.3**: 原稿一覧・新規作成・切替・削除
  - What: 一覧（タイトル＋更新時刻）、新規作成、切替時に現編集を自動保存して復元、削除（確認 UI・仮）。起動時は updatedAt 最大を既定表示（US-004/005/008）
  - Files: `web/src/list/ManuscriptList.svelte`, `web/src/state/*.ts`（編集状態・Svelte store）
  - Done when: 複数原稿の作成・切替・復元・削除が手動確認で成立、起動時に最新原稿が開く
  - Depends on: Task W2.1, W2.2

- [ ] **Task W2.4**: 自動保存（debounce）＋明示保存
  - What: 本文・タイトル編集の無操作時間後に `save` を呼ぶ自動保存と、明示保存ボタンを同一 save 経路で実装。`updatedAt=now` はアダプタ注入。保存失敗時は通知し編集内容を破棄しない（US-003・FR-007）
  - Files: `web/src/state/autosave.ts`, `web/src/editor/Editor.svelte`（保存制御）
  - Done when: 編集停止後に自動保存され、明示保存も即時に効く。保存失敗が通知される
  - Depends on: Task W2.1, W2.2

### Wave W3（PWA ＆ 通し検証）

- [ ] **Task W3.1**: PWA 化（vite-plugin-pwa）
  - What: `vite-plugin-pwa` を導入し、manifest（name/icons/standalone・仮）と Service Worker（アプリシェル precache・cache-first）を生成。`registerType`/`globPatterns` 設定、SW 登録。手書き SW は作らない
  - Files: `web/vite.config.ts`（VitePWA 設定）, `web/public/`（アイコン・仮）, 登録呼び出し
  - Done when: インストール可能（installable）＋ DevTools offline で起動・保存が成立（US-006・FR-006）
  - Depends on: Task W2.3, W2.4

- [ ] **Task W3.2**: end-to-end 通し検証
  - What: 「書く→保存→再読み込みで復元」、複数原稿切替・削除、オフライン起動＋保存を手動シナリオで確認。Lighthouse で PWA/installable 確認
  - Files: `specs/web/` に検証メモ追記（任意）
  - Done when: ROADMAP 最初のリリース完了条件（web の PWA 起動・オフライン・書く→保存→開く）を満たす
  - Depends on: Task W3.1

- [ ] **Task W3.3**: ドキュメント整備
  - What: ルート README（起動/ビルド手順・仮：core ビルド → web 消費の流れ）、ROADMAP の進捗追記
  - Files: `README.md`, `docs/ROADMAP.md`
  - Done when: 手順どおりで起動・ビルドが再現
  - Depends on: Task W3.2

## Progress
- Total: 8 tasks | Completed: 0 | In Progress: 0
- Wave W1: W1.1 ／ Wave W2: W2.1–W2.4 ／ Wave W3: W3.1–W3.3
- 前提: [../core/tasks.md](../core/tasks.md)（C2.4 出力に依存）
