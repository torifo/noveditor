# Novel→Episode Requirements — 連載（小説→話）構造

> スコープ: 一話完結でない小説（連載）に対応するため、**小説(Novel) → 話(Episode)** の階層を導入する。カクヨム／小説家になろうの「作品＝複数話」モデルを参考にする。
> 命名方針: コンテナ概念は **`Novel`（小説）** を用い、汎用語の `Work`/「作品」は使わない。
> 位置づけ: **v1 の構造機能**（現行 MVP の単層「原稿」を拡張）。本 spec は設計確定が目的で、実装時期は別途。型名・UI 文言は「仮」。core への影響は [../core/](../core/requirements.md)、UI は [../web/](../web/requirements.md) を更新する。

## Overview

現行の noveditor は「原稿(Manuscript)」のフラットな一覧を持つ。しかし小説は**連載＝複数話で1つの小説**という形態が多い（カクヨム・なろう）。本 spec は **小説(Novel)** が順序付きの **話(Episode)** を束ねる階層を導入する。**一話完結（単発）も同じモデルで自然に扱える**ことを要件とする（話が1つだけの小説）。

## 用語定義（仮）

- **小説 (Novel)**: 連載・単発を問わず1つの小説。タイトル・あらすじ（任意）・作成/更新時刻・話の並び順を持つ。
- **話 (Episode)**: 小説内の1話。話タイトル・本文・作成/更新時刻を持つ。**現行の「原稿(Manuscript)」が概ねこれに相当**する。
- **連載 / 完結**: 小説の状態（任意・将来の投稿連携用メタ。MVPでは必須としない）。

## User Stories

### US-N01: 小説を作る
**As a** 執筆者 **I want to** 小説を作成しタイトル（と任意のあらすじ）を付ける **So that** 連載をひとまとまりとして管理できる
- WHEN ユーザーが新規小説を作成する THE SYSTEM SHALL 一意な id を持つ空の小説を生成し小説一覧へ追加する
- THE SYSTEM SHALL 小説にタイトルと任意のあらすじを設定・変更できるようにする

### US-N02: 話を追加・並べ替える
**As a** 執筆者 **I want to** 小説に話を追加し、順序を入れ替える **So that** 連載の話数を構成できる
- WHEN ユーザーが小説に新規話を追加する THE SYSTEM SHALL 一意な id を持つ空の話を生成し、その小説の話順の末尾へ追加する
- WHEN ユーザーが話の順序を変更する THE SYSTEM SHALL 小説内の話の並び順を更新して永続化する

### US-N03: 話を書く
**As a** 執筆者 **I want to** 各話の本文とタイトルを書く **So that** 1話ずつ執筆できる
- THE SYSTEM SHALL 各話について、現行エディタと同等の編集体験（本文・話タイトル・文字数/枚数・自動保存・IME・ルビプレビュー等）を提供する

### US-N04: 小説・話を切り替える
**As a** 執筆者 **I want to** 小説と話を2階層でたどって切り替える **So that** 連載内を行き来できる
- WHEN ユーザーが小説を選ぶ THE SYSTEM SHALL その小説の話一覧（話タイトル＋更新時刻）を表示する
- WHEN ユーザーが話を選ぶ THE SYSTEM SHALL その話の本文・タイトルを編集領域へ復元する
- WHEN 小説/話を切り替える THE SYSTEM SHALL 切り替え前の編集内容を自動保存する

### US-N05: 単発小説も自然に扱う（一話完結）
**As a** 執筆者 **I want to** 単発の小説を、話の階層を意識せず書ける **So that** 短編でも煩雑にならない
- IF 小説の話が1つだけである THEN THE SYSTEM SHALL 話の階層 UI を最小化し、小説を開くと直接その話を編集できるようにする
- WHEN ユーザーが2話目を追加する THE SYSTEM SHALL 話一覧 UI を展開する

### US-N06: 既存原稿の移行
**As a** 既存ユーザー **I want to** これまでの原稿が失われずに新構造へ移る **So that** データが安全に引き継がれる
- WHEN 旧フラット原稿が存在する状態で本機能が有効化される THE SYSTEM SHALL 各旧原稿を「1話だけの小説」へ無損失で移行する（id・タイトル・本文・時刻を保持）

## Functional Requirements

### FR-NE01: データモデル（core）
THE SYSTEM SHALL `Novel`（id・タイトル・あらすじ?・createdAt・updatedAt・話順）と `Episode`（id・novelId・話タイトル・本文・createdAt・updatedAt）を core に定義し、直列化可能にする（現行 `Manuscript` は `Episode` へ一般化）。

### FR-NE02: Repository 拡張（port）
THE SYSTEM SHALL 小説の list/load/save/delete、小説内の話の list/load/save/delete/reorder を表す port を core に定義する（実体はアダプタ）。

### FR-NE03: 2階層 UI（web）
THE SYSTEM SHALL サイドバーを「小説 → 話」の2階層で提供し、小説の展開/折り畳み・話の追加/並べ替え/削除・単発小説の階層最小化を行う。

### FR-NE04: 移行
THE SYSTEM SHALL 旧 `noveditor:manuscript:*` / `noveditor:index` を新スキーマへ一度だけ移行する（各原稿＝1話小説）。

## Non-Functional Requirements

- **後方互換**: 既存データを無損失移行。移行は冪等（二重実行で壊れない）。
- **段階導入**: 単発体験を損なわない（話が1つなら従来どおり直接編集）。
- **core 純粋性**: モデル・port は core（時刻・id はアダプタ注入のまま）。
- **オフライン**: 端末内ストレージのみで成立。

## Out of Scope（この spec では作らない）

- 投稿サイト（カクヨム/なろう）への実投稿・連載状態同期 → 将来（エクスポートは v1 別項）
- 小説をまたぐ横断機能（全文検索・統計）→ v1.x
- 縦書き・書籍化（小説単位の結合 PDF 等）→ [tatemd](https://github.com/torifonium/tatemd) 連携（ROADMAP 参照）
