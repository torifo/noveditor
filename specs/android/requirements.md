# Android Requirements — Android ネイティブアダプタ

> スコープ: ROADMAP の **次リリース対象 = ネイティブ Android アプリ**。共有 core（[../core/requirements.md](../core/requirements.md)）を再利用し、Web（[../web/requirements.md](../web/requirements.md)）と同じ執筆体験をネイティブ Android で提供する。
> **本 spec は設計先行**: 最初のリリース（Web/PWA）と並行して設計を確定させ、core API が Android を詰まらせないことを保証する。実装は Web リリース後に着手。
> 用語・型名・UI 文言・パッケージ名はすべて「仮」（最終決定はユーザー主導）。

## Overview

Android アプリは、執筆者が「Android 端末のネイティブアプリで、オフラインでも、書いて・保存して・後で開き直せる」最小エディタである。校正やライトノベル支援は含まず（v1）。保存モデル・文字統計・保存先 port は core を **`androidTarget()`/JVM ターゲット**で再利用し、UI は **Jetpack Compose**、永続化は端末内ストレージで実装する。

> **Web との関係**: Web/PWA が最初のリリース。Android は core（countStats・モデル・`ManuscriptRepository` port）を Web と完全に共有し、アダプタ層（Compose UI ＋ 端末保存実装）だけを新規に作る。

## 用語定義（仮）

core の用語（Manuscript / ManuscriptSummary / DocumentStats / ManuscriptRepository）は [../core/requirements.md](../core/requirements.md) を参照。Android 固有:

- **保存先実体 (Android Repository)**: `ManuscriptRepository`(port) の Android 実装。端末内ストレージ（候補: ファイル＋index / DataStore / Room）を用いる。
- **Compose UI**: Jetpack Compose による編集・一覧画面。

## User Stories

> US-001〜005 / 007 / 008 は Web（[../web/requirements.md](../web/requirements.md)）と同一の体験を Android で実現する。AC も共通（保存先が端末内ストレージである点のみ差異）。US-006 のみ Android 固有に置換する。

### US-001: 原稿を書く
**As a** 執筆者 **I want to** Android のエディタに本文を入力する **So that** 思いついた文章をすぐ書き留められる

**Acceptance Criteria:**
- WHEN ユーザーが編集領域に文字を入力する THE SYSTEM SHALL 入力された文字を即時反映する
- WHEN ユーザーが日本語 IME で変換中である THE SYSTEM SHALL 変換確定前の未確定文字列を文字数集計に含めない
- WHILE 編集領域にフォーカスがある THE SYSTEM SHALL 改行・全角文字・絵文字（サロゲートペア）を欠落なく保持する

### US-002: 文字数・行数を把握する
**Acceptance Criteria:**
- WHEN 本文が変化する THE SYSTEM SHALL 文字数（コードポイント基準・core `countStats`）と行数を再計算して表示を更新する
- THE SYSTEM SHALL 文字数を「総文字数」「空白・改行を除く文字数」の両方で提供する
- IF 本文が空である THEN THE SYSTEM SHALL 文字数 0・行数 0 を表示する

### US-003: 原稿を保存する（自動＋明示）
**Acceptance Criteria:**
- WHILE ユーザーが本文・タイトルを編集している THE SYSTEM SHALL 一定の無操作時間（debounce）後に原稿を端末内ストレージへ自動で永続化する
- WHEN ユーザーが明示的に保存を実行する THE SYSTEM SHALL その時点の本文・タイトル・更新時刻を即時に永続化する
- WHEN 原稿が保存される THE SYSTEM SHALL 更新時刻 (updatedAt) を保存時点の値へ更新する
- IF 端末ストレージへの保存に失敗する THEN THE SYSTEM SHALL 保存失敗を通知し、編集中の内容を破棄しない

### US-004: 原稿を開き直す
**Acceptance Criteria:**
- WHEN ユーザーがアプリを再起動する THE SYSTEM SHALL 保存済み原稿を読み出せる状態にする
- WHEN 起動時に保存済み原稿が存在する THE SYSTEM SHALL 最後に更新された原稿（updatedAt 最大）を既定で表示する
- WHEN ユーザーが一覧から原稿を選択する THE SYSTEM SHALL 選択原稿の本文・タイトルを編集領域に復元する
- IF 保存データが存在しない THEN THE SYSTEM SHALL 空の初期状態を表示する

### US-005: 複数原稿を作成・切り替える
**Acceptance Criteria:**
- WHEN ユーザーが新規原稿を作成する THE SYSTEM SHALL 一意な id を持つ空の原稿を生成し一覧へ追加する
- WHEN ユーザーが別の原稿へ切り替える THE SYSTEM SHALL 切り替え前の編集内容を保存した上で、選択原稿を表示する
- THE SYSTEM SHALL 一覧に各原稿のタイトル（仮文言）と更新時刻を表示する

### US-006: オフラインで利用する（ネイティブ）
**As a** 執筆者 **I want to** ネット接続が無くてもアプリを起動して書く **So that** 通信環境に依存せず執筆できる

**Acceptance Criteria:**
- THE SYSTEM SHALL ネットワーク接続に依存せず、端末内ストレージのみで「書く・保存・開き直す」を成立させる（ネイティブアプリのため SW/manifest は不要）
- THE SYSTEM SHALL アプリを APK / アプリストア配信でインストール可能にする（配信形態は仮・ユーザー決定）

### US-007: 原稿のタイトルを付ける・変更する
**Acceptance Criteria:**
- WHEN ユーザーがタイトル入力欄を編集する THE SYSTEM SHALL 入力値を当該原稿のタイトルとして反映し、保存対象に含める
- WHEN 新規原稿が作成される THE SYSTEM SHALL 既定タイトル（仮文言）を付与し、変更可能にする
- WHEN タイトルが変更され保存される THE SYSTEM SHALL 一覧表示のタイトルへ反映する

### US-008: 原稿を削除する
**Acceptance Criteria:**
- WHEN ユーザーが一覧から削除を実行する THE SYSTEM SHALL 当該原稿を端末内ストレージと一覧から取り除く
- WHEN 削除対象が現在編集中の原稿である THE SYSTEM SHALL 削除後に別の原稿（無ければ空の初期状態）を表示する
- THE SYSTEM SHALL 削除前に確認（仮: 確認 UI の形式はユーザー決定）を挟む

## Functional Requirements

> FR-001（countStats）/ FR-002（モデル）/ FR-003（Repository port）は core が提供（[../core/requirements.md](../core/requirements.md)）。Android は `androidTarget()`/JVM で再利用し、以下の Android 固有 FR を満たす。

### FR-A04: 端末内ストレージ Repository 実装
**Priority:** P0 **Persona:** 執筆者
WHEN Android アダプタが Repository を必要とする THE SYSTEM SHALL 端末内ストレージを用いた `ManuscriptRepository` 実装を提供する
**Rationale:** MVP の保存先。core の純粋性を保ったまま端末永続化を成立させる。実装方式は design（ファイル＋index / DataStore / Room）で確定。

### FR-A05: 最小エディタ UI（Jetpack Compose）
**Priority:** P0 **Persona:** 執筆者
THE SYSTEM SHALL Compose ベースの編集領域・タイトル入力欄・文字数/行数表示・原稿一覧・新規作成/切替/削除・明示保存を持つ最小 UI を提供する（文言は仮）
**Rationale:** ネイティブ Compose は IME を標準対応し、canvas 描画系の制約を受けない。

### FR-A06: インストール／配信
**Priority:** P0 **Persona:** 執筆者
THE SYSTEM SHALL APK ビルドおよびアプリストア配信でインストール可能にする（署名・配信形態は仮）
**Rationale:** ネイティブアプリの「インストール可能」要件（Web の PWA installable に対応）。

### FR-A07: 自動保存（debounce）と明示保存
**Priority:** P0 **Persona:** 執筆者
WHILE 本文・タイトルが編集される THE SYSTEM SHALL 一定の無操作時間後に `Repository.save` を呼び、明示保存と同一経路で永続化する
**Rationale:** US-003。Web と同じ「消えない」主経路。

### FR-A08: 原稿削除（UI ＋ アダプタ）
**Priority:** P0 **Persona:** 執筆者
WHEN ユーザーが削除を実行する THE SYSTEM SHALL `Repository.delete` を呼び、端末内ストレージと一覧から当該原稿を除去する
**Rationale:** US-008。core port の delete を Android UI まで通す。

## Non-Functional Requirements

- **技術スタック（暫定）**: Jetpack Compose ＋ Kotlin。core は `androidTarget()`/JVM で再利用。永続化方式は design で確定。
- **core 再利用**: countStats・モデル・port は Web と完全共有し、Android で再実装しない。
- **副作用源の注入**: id 採番・現在時刻は Android アダプタが供給（`UUID` / `System.currentTimeMillis()`）。
- **正確性・永続性・性能**: Web の NFR に準拠（コードポイント基準・データ欠落なし・体感遅延なし）。

## Out of Scope（この spec では作らない）

- 校正・表記ゆれ・ライトノベル支援 → v1
- クラウド同期・サーバー (`server/`)・MCP → 将来
- 縦書き表示・テーマ/フォント設定・編集履歴 → v1.x
- iOS 展開 → 将来
