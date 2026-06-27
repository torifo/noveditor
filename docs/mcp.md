# MCP.md — noveditor の MCP 化ガイド

> 執筆支援エディタ (noveditor) を MCP サーバーとして公開するための設計・手順メモ。
> **MVP には含めない。** コア層に「人間にも AI にも共有できる純粋ロジック」が育ってから着手する「拡張レイヤー」として扱う。

---

## 現状の反映 (as of this update)

このメモは初期に書かれ、当時の想定（モジュール名・コアが校正/変換ロジックを持つ前提・アダプタが Kotlin/WASM/CLI である前提）が現状とズレていた。実リポジトリを確認し、以下を反映して更新した。

**今あるもの（実在）**

- モジュールは `core/`（Kotlin Multiplatform）と `web/`（TypeScript + Vite + Svelte 5）の 2 つ。`android/` は **specs のみ**（実装は将来）。`server/`（Ktor）は **存在しない**（将来構想）。Gradle の `settings.gradle.kts` に登録されているのも `:core` だけ。
- `core/` は **js(IR) ライブラリ**（`.mjs` + 型定義 `.d.mts`）を出力し、それを TypeScript の `web/` が消費する構成。加えて **JVM ターゲット**を持つ（現状の主目的は `commonTest` を速く回すためだが、`core-jvm.jar` を生成しており JVM から直接依存できる）。
- コアにある**純粋ロジックは `countStats`（文字数・行数・段落数）ただ 1 つ**（`commonMain`、JVM/JS 両方でテスト済み）。ほかは保存モデル（`Manuscript` / `Novel` / `Episode` とその Summary）と Repository ポート（`ManuscriptRepository` / `NovelRepository`）。
- ルビ（`｜漢字《かんじ》` → `<ruby>`）と圏点（`《《…》》` → `<em class="bouten">`）の変換は **`web/src/editor/renderRuby.ts`（TypeScript 側）にあり、コアには無い**。

**まだ無いもの（future）**

- 校正エンジン・約物整形・セリフ率・キャラ語尾チェックなどの **v1 校正/ラノベ機能のコアは未実装**。本メモ §3 のツール候補はすべてこれら未実装機能に依存する「将来のツール」。
- MCP サーバーモジュール（`mcp/`）は未作成。
- 縦書き・組版・書籍化 PDF は **noveditor では実装しない**。外部 OSS **[tatemd](https://github.com/torifonium/tatemd)** に委譲する方針（§6 参照）。

要するに、現時点で MCP ツールとして即座に切り出せる純粋関数は `countStats` だけ。それ以外は「まず v1 校正コアを `commonMain` の純粋関数として書く」ことが MCP 化の前提になる。

---

## 0. 前提と方針

- **位置づけ**: MCP は機能（インターフェース）であって、ドメインではない。noveditor の（将来の）校正・変換ロジックを、人間は GUI から / エージェントは MCP から、同じコアを叩く形にする。
- **3層分離**: `core`（純粋ロジック）/ アダプタ（現状は `web` の TypeScript+Svelte、将来 `android`）/ `mcp`（後付け）。MCP 層はコアを呼ぶだけで、ロジックを再実装しない。
- **言語と結合方式**: コアは Kotlin (KMP)。コアは js(IR) ライブラリ（`.d.mts` 付き）として TypeScript+Svelte の Web アプリに消費される一方、**JVM ターゲットも持つ**。MCP サーバーはこの **JVM ターゲットの `core` に直接依存する JVM モジュール**として書くのが素直で、公式 Kotlin SDK (`io.modelcontextprotocol:kotlin-sdk`) を使えば**関数呼び出しで直結**できる（サブプロセス不要）。「コアと同一言語なので直結」という当初の狙いは、この「KMP コアの JVM ターゲットへ直接依存」という形で正確に実現する。
- **やらないこと**: MVP 時点では MCP サーバーを実装しない。さらに今の段階ではコアに公開すべき校正/変換ロジックがまだ無いので、**まず v1 校正コアを純粋関数として書く**のが先。コアを「MCP から呼べる形」に整えるところまでが前提作業。

---

## 1. ディレクトリ構成（MCP 層の置き場所）

実在するモジュールは `core/` と `web/` のみ（`android/` は specs のみ、`server/` は将来構想）。`mcp/` は同じ無印命名で兄弟モジュールとして追加する想定。

```
editor/
└── noveditor/
    ├── core/        # Kotlin Multiplatform 共有コア（js(IR) ライブラリ + JVM ターゲット）★MCPはここを呼ぶ
    │                #   現状: countStats（純粋） + 保存モデル + Repository ポート
    ├── web/         # Web/PWA アダプタ（TypeScript + Vite + Svelte 5）。core の JS ライブラリを消費
    ├── android/     # ネイティブ Android アダプタ（将来 / 現状 specs のみ）
    ├── server/      # Ktor バックエンド（将来構想・未作成）
    └── mcp/         # ★MCPサーバー（後付け・未作成・MVP対象外）
        ├── src/
        │   └── main/kotlin/
        │       ├── Main.kt          # サーバー起動・トランスポート選択
        │       ├── Tools.kt         # ツール定義（core を呼ぶ薄いラッパ）
        │       └── Schemas.kt       # 入出力スキーマ
        ├── build.gradle.kts
        └── README.md
```

ポイント: `mcp` は `core`（の JVM ターゲット）に依存するだけ。アダプタ群（`web` / 将来の `android`）とは兄弟関係で、互いに依存しない。追加時は `settings.gradle.kts` に `include(":mcp")` を足す（現状の登録は `:core` のみ）。

---

## 2. 「MCP から呼べるコア」にしておくための約束

コアに校正・変換ロジックを書く段階で、後の MCP 化を楽にする設計上の約束。**既存の `countStats` がこのパターンの手本**で、`commonMain` に置かれた「文字列を受け取って `DocumentStats` を返す」純粋関数であり、副作用（時計・I/O）を持たない。新しい校正/変換ロジックも同じ形で書く。

1. **副作用を持たない純粋関数にする**: 校正・変換ロジックはファイル I/O や UI 状態に触れず、「文字列を受け取って結果を返す」形にする（`countStats` と同じ）。MCP ツールはこれをそのまま公開できる。
2. **入出力を明示的な型にする**: `data class` で入力・出力を定義（例: `DocumentStats` の流儀で `ProofreadResult`, `RubyConvertResult` 等）。MCP のスキーマ生成がそのまま流用できる。
3. **機能単位で関数を分ける**: 「セリフ率を出す」「三点リーダーを矯正する」「ルビ記法に変換する」を別関数に。MCP ツールは原則 1 機能 = 1 ツール。
4. **エラーを例外でなく結果型で返す**: `Result<T>` 等で失敗を表現。MCP のエラーレスポンスに変換しやすい。
5. **Repository は対象外**: `ManuscriptRepository` / `NovelRepository` は保存（副作用）を担うポートであり、**意図的に純粋でない**。MCP に公開するのは純粋な変換・分析関数に限定し、永続化ロジックは公開しない。

---

## 3. 公開するツール候補（core の機能 → MCP tool）

> **重要（現状の反映）**: 下表のうち `count_stats` を除く 5 つは、**まだコアに存在しない v1 校正/ラノベ機能**に対応する。すなわち**いずれも「将来のツール」であり、先に対応するコア関数を `commonMain` の純粋関数として実装することが前提**。今の時点で唯一そのまま切り出せるのは `countStats`（実在・純粋・JVM/JS 検証済み）。

| MCP tool 名 | 対応する core 関数 | 状態 | 入力 | 出力 |
|---|---|---|---|---|
| `count_stats` | `countStats`（実在） | **実装可能（唯一）** | テキスト | 文字数・空白除く文字数・行数・段落数 |
| `proofread_text` | 校正エンジン（未実装） | future | 原稿テキスト | 検出された問題（表記ゆれ・敬体常体混在・語尾連続）のリスト |
| `convert_ruby` | ルビ記法変換（未実装：現状は `web/renderRuby.ts`） | future（要コア移植） | テキスト, 出力形式(なろう/カクヨム) | 変換後テキスト |
| `normalize_punctuation` | 約物整形（未実装） | future | テキスト | 三点リーダー・ダッシュを 2 個 1 組に矯正したテキスト |
| `dialogue_ratio` | セリフ率計算（未実装） | future | テキスト | 会話文/地の文の比率 |
| `check_character_voice` | キャラ語尾一貫性（未実装） | future | テキスト, キャラ語尾定義 | 逸脱箇所のリスト |

> **ルビ/圏点に関するギャップ**: `convert_ruby`（および圏点）に相当するロジックは現状 **`web/src/editor/renderRuby.ts` の TypeScript 側にしか無い**（HTML 出力前提のプレビュー用）。MCP から使うには、まずこのロジックを **`core/commonMain` へ移植（または抽出）して Web と MCP で共有**する必要がある。Web の HTML プレビュー出力と、投稿サイト記法（なろう/カクヨム）への変換は別関心なので、コア側は「記法 → 中間表現／別記法」の純粋変換として切り出すのが望ましい。
>
> プロンプト/リソースは初期は不要。まず tools だけで MVP-MCP とする。

---

## 4. 実装フロー（着手時の手順）

> 前提: §7 のチェックリスト（特に **v1 校正コアが純粋関数として存在すること**）を満たしてから着手する。`count_stats` だけなら今でも疎通用に使える。

### Step 1. SDK 導入
- `mcp/build.gradle.kts` に Kotlin MCP SDK を追加。
- `core`（JVM ターゲット）をプロジェクト依存に追加し、`settings.gradle.kts` に `include(":mcp")` を足す。

### Step 2. トランスポート選定
- **stdio**: Claude Code / Claude Desktop などローカルエージェントから使う標準形。まずこれ。
- **HTTP(SSE/Streamable)**: リモート公開する場合。MVP-MCP では stdio のみで十分。

### Step 3. ツール 1 個だけ実装（最小サーバー）
- まず **`count_stats`（`countStats` をそのまま公開・副作用ゼロ・入出力単純・既に実在）** を 1 個だけ公開して疎通確認。校正系コアが揃うまではこれが最小例になる。
- core 関数を import → 入力スキーマ定義 → ツール登録 → サーバー起動、の最小ループを通す。

### Step 4. 疎通テスト
- ローカルの MCP クライアント（Claude Code 等）に stdio で接続し、`count_stats` が呼べることを確認。
- 接続設定（コマンドパス・引数）を README に控える。

### Step 5. 残りのツールを追加
- §3 の future ツールは、**対応するコア関数を実装してから**順に公開する。1 ツールずつ追加し、その都度クライアントから確認。`convert_ruby` は先に `renderRuby.ts` 相当のコア移植が必要。

### Step 6. エラー・境界処理
- 空文字、巨大入力、不正な出力形式指定などの異常系をツール側で握り、MCP エラーとして返す。

### Step 7. ドキュメント化
- `mcp/README.md` に「接続方法」「各ツールの入出力例」を記載。

---

## 5. 接続イメージ（ローカルエージェント / stdio）

エージェント側の MCP 設定（概念図）:

```jsonc
{
  "mcpServers": {
    "noveditor": {
      "command": "java",
      "args": ["-jar", "path/to/noveditor-mcp.jar"]
    }
  }
}
```

> 実際のコマンドはビルド成果物の形態（jar / native-image / Gradle run）で変わる。Step 4 で確定したものをここに記録する。

---

## 6. 「育てる」観点での MCP 拡張余地（Coming Soon）

- **resources 公開**: 自分の原稿フォルダを MCP リソースとして読めるようにし、「この章を校正して」をエージェントが直接実行。
- **prompts 公開**: 「ライトノベル文体でリライト」などの定型プロンプトをサーバー側で提供。
- **HTTP 公開**: ローカル stdio からリモート Streamable HTTP へ拡張し、複数デバイスから利用（`server/`（Ktor）導入が前提になりうる）。
- **縦書き / 書籍化 PDF は tatemd 経由**: 「縦書きレンダリング」「書籍 PDF 出力」を MCP ツールとして欲しくなっても、**noveditor 側で再実装しない**。縦書き組版・禁則・A5/B6 書籍 PDF・絵巻長尺は外部 OSS **[tatemd](https://github.com/torifonium/tatemd)** に委譲する方針（ROADMAP の外部連携方針どおり）。tatemd は埋め込み可能化が進んでおり（npm の `renderVerticalHtml` / `verticalCss` / `tatemd/print` 等）、そうした機能は tatemd 自身の MCP/ライブラリ責務として扱うか、noveditor からは tatemd を呼ぶ薄いブリッジに留める。二重実装は避ける。
- **他プロジェクト連携**: 暗号コアと組み合わせ、原稿を暗号化して保存するツールを追加、など。

---

## 7. チェックリスト（着手前に満たすべき前提）

- [ ] **（最重要）v1 校正/変換コアが `core/commonMain` の純粋関数として書かれている**（現状は未実装。`countStats` を手本に）
- [ ] ルビ/圏点を MCP で扱う場合、`web/renderRuby.ts` のロジックがコア（`commonMain`）に移植・共有されている
- [ ] 公開対象ロジックが副作用を持たない純粋関数化されている（Repository などの保存系は対象外）
- [ ] 入出力が `data class` で型定義されている（`DocumentStats` の流儀）
- [ ] 機能が 1 機能 1 関数で分かれている
- [ ] core が GUI/ファイル I/O に依存していない
- [ ] `mcp/` モジュールを追加し `settings.gradle.kts` に登録した（現状は `:core` のみ）
- [ ] （上記が満たされて初めて MCP 化に着手。`count_stats` だけなら先行して疎通確認に使える）
