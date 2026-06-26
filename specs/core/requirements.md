# Core Requirements — 共有ロジック（Kotlin / KMP）

> スコープ: ノヴェディタの **プラットフォーム非依存な純粋ロジック**（保存モデル・文字統計・保存先 port・JS ライブラリ出力）。
> 各アダプタが共有して消費する: Web（[../web/requirements.md](../web/requirements.md)）／ 将来の Android（[../android/requirements.md](../android/requirements.md)）／ 将来の server・MCP。
> 型名・パッケージ名は「仮」（最終決定はユーザー主導）。

## Overview

`core/` は DOM・ブラウザ API・I/O・UI フレームワークを一切参照しない純粋 Kotlin/KMP モジュール。**保存モデル**・**文字統計関数 `countStats`**・**保存先 `ManuscriptRepository`（port）** を提供し、永続化や UI の実体は各アダプタが与える。Web 消費のため `js(IR)` ライブラリ＋ TS 型定義（`.d.mts`）としても出力する。

## 用語定義（仮）

- **原稿 (Manuscript)**: 1 本の執筆対象。タイトル・本文・作成/更新時刻を持つ。
- **原稿一覧メタ (ManuscriptSummary)**: 一覧表示用の軽量メタ（id・タイトル・更新時刻）。本文を載せない。
- **文字統計 (DocumentStats)**: 本文から算出する文字数・行数・段落数の集計値。
- **保存先 (ManuscriptRepository)**: 原稿永続化の出入口。core では interface（port）として定義し、実体はアダプタが担う。

## このコアが支える User Story

ユーザー向け User Story は各アダプタ spec に定義する。core は技術的に以下を支える:

- **US-002（文字数・行数）** → `countStats`
- **US-003 / 004 / 005 / 008（保存・読み出し・一覧・削除）** → `ManuscriptRepository` port ＋ モデル ＋ 直列化

## Functional Requirements

### FR-001: 文字統計の算出（純粋ロジック）
**Priority:** P0 **Persona:** 執筆者（アダプタ経由）
WHEN 本文文字列が与えられる THE SYSTEM SHALL コードポイント基準の総文字数・空白除外文字数・行数・段落数を返す純粋関数を `core/` に提供する
**Rationale:** 日本語執筆では字数が成果指標。UTF-16 単位だと絵文字・異体字でズレるためコードポイント基準を必須とする。UI 非依存にして全アダプタで共有する。段落数は v1（セリフ比率等）への布石として算出するが、**MVP UI では非表示**（表示は文字数・行数のみ）。

### FR-002: 保存モデルの定義
**Priority:** P0 **Persona:** 開発（基盤）
THE SYSTEM SHALL 原稿を表すデータモデル（id・タイトル・本文・createdAt・updatedAt）を `core/` に定義し、kotlinx.serialization で直列化可能にする
**Rationale:** アダプタ間で同一モデルを使い、永続化・将来同期の土台にする。

### FR-003: 保存先 port の定義
**Priority:** P0 **Persona:** 開発（基盤）
THE SYSTEM SHALL 原稿の save / load / list / delete を表す Repository インターフェースを `core/` に定義する（実体はアダプタ側）
**Rationale:** 3層分離の要。core を I/O 非依存に保ち、LocalStorage / 将来 Android・同期・MCP を後付けできる形にする。

### FR-C04: JS ライブラリ出力（web 消費）
**Priority:** P0 **Persona:** 開発（基盤）
THE SYSTEM SHALL core の公開 API（`countStats`・モデル・`ManuscriptRepository` 型）に `@JsExport` を付与し、`js(IR)` ライブラリ＋ `.d.mts`（TS 型定義）として出力する
**Rationale:** web（TypeScript + Vite + Svelte 5）が型付きで core を消費するため。

## Non-Functional Requirements

- **アーキテクチャ**: 純粋ロジックのみ（DOM / ブラウザ API / I/O / UI フレームワークを import しない）。
- **副作用源の注入**: id 生成（採番）と現在時刻（createdAt / updatedAt）は **アダプタが供給して core へ渡す**。core は乱数源・時刻源を持たない（決定的にテスト可能に保つ）。
- **正確性**: 文字数はコードポイント基準。サロゲートペア（絵文字・第3水準漢字等）を 1 文字として数える。
- **テスト容易性**: FR-001〜003 は `commonTest` で UI なしに単体テスト可能であること。
- **ツールチェーン**: Gradle Wrapper 同梱（gradle 未インストール環境のため必須）。`kotlin("multiplatform")` ＋ `kotlin("plugin.serialization")`。

## Out of Scope（この spec では作らない）

- UI・編集体験（エディタ／一覧／統計表示）→ 各アダプタ spec
- 永続化の実体（LocalStorage / Room / DataStore 等）→ 各アダプタ spec
- PWA / Service Worker → [../web/](../web/requirements.md)
- 校正・表記ゆれ・ライトノベル支援 → v1
