# Web Requirements — Web / PWA アダプタ

> スコープ: ROADMAP の **MVP「まず書けて、消えない」の最初のリリース対象 = Web/PWA**。共有 core（[../core/requirements.md](../core/requirements.md)）を消費し、ブラウザ／インストール済み PWA で「書いて・保存して・後で開き直す」をオフライン成立させる。
> 用語・型名・UI 文言・PWA 名称はすべて「仮」（最終決定はユーザー主導）。

## Overview

ノヴェディタ Web は、小説／ライトノベル執筆者が「ブラウザ／インストール済み PWA で、オフラインでも、書いて・保存して・後で開き直せる」最小エディタである。校正やライトノベル支援は含まず（v1）、執筆体験の土台のみを対象とする。保存モデル・文字統計・保存先 port は core（[../core/](../core/requirements.md)）に分離済みで、本アダプタはそれを **TypeScript + Vite + Svelte 5** から消費する。

> **Android との関係**: 最初のリリースは Web/PWA。Android ユーザーにはインストーラブル PWA で到達する。ネイティブ Android アプリは次リリース・別 spec（[../android/requirements.md](../android/requirements.md)）で、同じ core を再利用する。

## 用語定義（仮）

core の用語（Manuscript / ManuscriptSummary / DocumentStats / ManuscriptRepository）は [../core/requirements.md](../core/requirements.md) を参照。web 固有:

- **保存先実体 (LocalStorage Repository)**: `ManuscriptRepository`(port) の web 実装。ブラウザ LocalStorage を用いる。
- **PWA シェル**: アプリの起動に必要な静的資産（HTML/JS/CSS）。Service Worker でキャッシュする。

## User Stories

### US-001: 原稿を書く
**As a** 執筆者 **I want to** ブラウザ上のエディタに本文を入力する **So that** 思いついた文章をすぐ書き留められる

**Acceptance Criteria:**
- WHEN ユーザーがエディタの編集領域に文字を入力する THE SYSTEM SHALL 入力された文字を編集領域に即時反映する
- WHEN ユーザーが日本語 IME で変換中（composition 中）である THE SYSTEM SHALL 変換確定前の未確定文字列を文字数集計に含めない
- WHILE 編集領域にフォーカスがある THE SYSTEM SHALL 改行・全角文字・絵文字（サロゲートペア）を欠落なく保持する

### US-002: 文字数・行数を把握する
**As a** 執筆者 **I want to** 現在の本文の文字数と行数を見る **So that** 規定枚数・分量の進捗を把握できる

**Acceptance Criteria:**
- WHEN 本文が変化する THE SYSTEM SHALL 文字数（コードポイント基準）と行数を再計算して表示を更新する（算出は core `countStats`）
- THE SYSTEM SHALL 文字数を「総文字数」「空白・改行を除く文字数」の両方で提供する
- IF 本文が空である THEN THE SYSTEM SHALL 文字数 0・行数 0 を表示する

### US-003: 原稿を保存する（自動＋明示）
**As a** 執筆者 **I want to** 書いた原稿が自動で端末に保存され、必要なら手動でも保存できる **So that** ページを閉じても内容が消えず、保存タイミングも自分で確定できる

**Acceptance Criteria:**
- WHILE ユーザーが本文・タイトルを編集している THE SYSTEM SHALL 一定の無操作時間（debounce）後に原稿を自動で端末内ストレージへ永続化する
- WHEN ユーザーが明示的に保存を実行する THE SYSTEM SHALL その時点の本文・タイトル・更新時刻を即時に永続化する
- WHEN 原稿が保存される（自動・明示いずれも） THE SYSTEM SHALL 更新時刻 (updatedAt) を保存時点の値へ更新する
- IF 端末ストレージへの保存に失敗する THEN THE SYSTEM SHALL ユーザーに保存失敗を通知し、編集中の内容を破棄しない

### US-004: 原稿を開き直す
**As a** 執筆者 **I want to** 保存済みの原稿を後から開く **So that** 続きから執筆を再開できる

**Acceptance Criteria:**
- WHEN ユーザーがアプリを再起動（再読み込み）する THE SYSTEM SHALL 保存済み原稿を読み出せる状態にする
- WHEN アプリ起動時に保存済み原稿が存在する THE SYSTEM SHALL 最後に更新された原稿（updatedAt 最大）を既定で編集領域へ復元する
- WHEN ユーザーが一覧から原稿を選択する THE SYSTEM SHALL 選択された原稿の本文・タイトルを編集領域に復元する
- IF 保存データが存在しない THEN THE SYSTEM SHALL 空の初期状態を表示する

### US-005: 複数原稿を作成・切り替える
**As a** 執筆者 **I want to** 複数の原稿を作って切り替える **So that** 作品ごとに分けて執筆できる

**Acceptance Criteria:**
- WHEN ユーザーが新規原稿を作成する THE SYSTEM SHALL 一意な id を持つ空の原稿を生成し一覧へ追加する
- WHEN ユーザーが別の原稿へ切り替える THE SYSTEM SHALL 切り替え前の編集内容を保存した上で、選択原稿を編集領域へ表示する
- THE SYSTEM SHALL 一覧に各原稿のタイトル（仮文言）と更新時刻を表示する

### US-006: オフラインで利用する（PWA）
**As a** 執筆者 **I want to** ネット接続が無くてもアプリを起動して書く **So that** 通信環境に依存せず執筆できる

**Acceptance Criteria:**
- WHEN ユーザーが対応ブラウザでアプリへ初回アクセスする THE SYSTEM SHALL アプリをインストール可能（installable）にする
- WHILE 端末がオフラインである THE SYSTEM SHALL キャッシュ済みアプリシェルから起動し、書く・保存を成立させる
- WHEN アプリが起動する THE SYSTEM SHALL Service Worker を登録しアプリシェルをキャッシュする

### US-007: 原稿のタイトルを付ける・変更する
**As a** 執筆者 **I want to** 原稿にタイトルを付け、後から変更する **So that** 一覧で作品を見分けられる

**Acceptance Criteria:**
- WHEN ユーザーがタイトル入力欄を編集する THE SYSTEM SHALL 入力値を当該原稿のタイトルとして反映し、保存対象（自動・明示）に含める
- WHEN 新規原稿が作成される THE SYSTEM SHALL 既定タイトル（仮文言・ユーザー決定）を付与し、ユーザーが変更可能にする
- WHEN タイトルが変更され保存される THE SYSTEM SHALL 一覧表示のタイトルへ反映する

### US-008: 原稿を削除する
**As a** 執筆者 **I want to** 不要になった原稿を削除する **So that** 一覧を整理できる

**Acceptance Criteria:**
- WHEN ユーザーが一覧から原稿の削除を実行する THE SYSTEM SHALL 当該原稿を端末内ストレージと一覧から取り除く
- WHEN 削除対象が現在編集中の原稿である THE SYSTEM SHALL 削除後に別の原稿（無ければ空の初期状態）を編集領域へ表示する
- THE SYSTEM SHALL 誤操作防止のため削除前に確認（仮: 確認 UI の形式はユーザー決定）を挟む

## Functional Requirements

> FR-001（countStats）/ FR-002（モデル）/ FR-003（Repository port）は core が提供（[../core/requirements.md](../core/requirements.md)）。本アダプタはそれらを消費し、以下の web 固有 FR を満たす。

### FR-004: LocalStorage アダプタ実装
**Priority:** P0 **Persona:** 執筆者
WHEN Web アダプタが Repository を必要とする THE SYSTEM SHALL ブラウザの LocalStorage を用いた `ManuscriptRepository` 実装を web に提供する
**Rationale:** MVP の保存先。core の純粋性を保ったままブラウザ永続化を成立させる。

### FR-005: 最小エディタ UI（Svelte / DOM）
**Priority:** P0 **Persona:** 執筆者
THE SYSTEM SHALL Svelte/DOM ベースの編集領域・タイトル入力欄・文字数/行数表示・原稿一覧・新規作成/切替/削除操作・明示保存操作を持つ最小 UI を提供する（マークアップ文言は仮）
**Rationale:** 日本語 IME と将来の縦書き/ルビのため編集面は DOM とする。Svelte はきめ細かい更新で contenteditable と競合しにくい。

### FR-006: PWA 化（vite-plugin-pwa）
**Priority:** P0 **Persona:** 執筆者
THE SYSTEM SHALL Web App Manifest と Service Worker を vite-plugin-pwa で備え、インストール可能・オフライン起動可能にする
**Rationale:** ROADMAP の MVP 最低ライン（Web のアプリ化）。

### FR-007: 自動保存（debounce）と明示保存
**Priority:** P0 **Persona:** 執筆者
WHILE 本文・タイトルが編集される THE SYSTEM SHALL 一定の無操作時間後に `Repository.save` を呼び、明示保存ボタンと同一経路で永続化する
**Rationale:** US-003。「消えない」体験の主経路を自動保存とし、明示保存は確定操作・フォールバックとして併存させる。

### FR-008: 原稿削除（UI ＋ アダプタ）
**Priority:** P0 **Persona:** 執筆者
WHEN ユーザーが削除を実行する THE SYSTEM SHALL `Repository.delete` を呼び、本文・index 双方から当該原稿を除去する
**Rationale:** US-008。core port の delete を web UI まで通し、一覧の整理を成立させる。

## Non-Functional Requirements

- **Web 技術スタック（確定）**: web フロントは **TypeScript + Vite + Svelte 5**、PWA は **vite-plugin-pwa**。core（Kotlin/KMP）は `js(IR)` ライブラリ＋TS 型定義として消費する。
- **性能**: 1 万文字程度の本文で、入力 1 ストロークあたりの再計算が体感遅延なく完了する（目標 < 16ms / 計測は実装時に確定）。
- **永続性**: 通常操作（保存→再読み込み）でデータ欠落が無いこと。
- **アーキテクチャ**: コア外ロジック（校正・同期）を抱え込まない。core の port/モデルを介して永続化する。

## Out of Scope（この spec では作らない）

- 校正・表記ゆれ・ライトノベル支援（ルビ記法含む）→ v1
- **ネイティブ Android アプリ → [../android/](../android/requirements.md)（次リリース・別 spec）**
- クラウド同期・サーバー (`server/`)・MCP → 将来
- 縦書き表示・テーマ/フォント設定・編集履歴/バージョン管理 → v1.x（※ 単純な自動保存（debounce）は US-003 として MVP に含む。履歴・差分復元のみ v1.x）
