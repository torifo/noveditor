# noveditor

> 小説・ライトノベル執筆支援エディタ。「まず書けて、消えない」を最小構成で実現する MVP。
> A novel / light-novel writing editor. MVP focused on "write first, never lose it."

Kotlin Multiplatform の共有コアを軸に、Web/PWA を最初のリリースとして公開するモノレポです。
A monorepo built around a Kotlin Multiplatform shared core, shipping Web/PWA as the first release.

> 名称・アイコン・テーマ色は **仮**（provisional）。最終決定はユーザー主導で行います。
> Names, icons, and theme colors are **provisional** and will be finalized later.

## 構成 / Structure

3 層分離（コア／アダプタ／将来の MCP）を採用しています。
A 3-layer split: shared core / platform adapters / (future) MCP.

| ディレクトリ | 役割 |
|---|---|
| `core/` | Kotlin Multiplatform 共有コア。保存モデル・文字数/行数ロジック・Repository port。プラットフォーム非依存。 |
| `web/` | Web/PWA アダプタ。TypeScript + Vite + Svelte 5 + vite-plugin-pwa。`core/` の JS ライブラリを消費。 |
| `android/` | ネイティブ Android アダプタ（**将来**／次リリース。`core/` を再利用予定）。 |

- 仕様: [`specs/`](./specs/)（`specs/core/`・`specs/web/`・`specs/android/`）
- ロードマップ: [`docs/ROADMAP.md`](./docs/ROADMAP.md)

## ビルド / 実行手順 / Build & Run

**ビルド順は固定**です。`web/` は `core/` のビルド出力（JS ライブラリ）をローカルリンクで消費するため、必ず core を先にビルドします。
The build order is fixed: `web/` consumes the core's JS library via a local link, so build the core first.

```bash
# 1) コア（Kotlin/KMP）の JS ライブラリをビルド / build the Kotlin core JS library
#    出力: core/build/dist/js/productionLibrary/（.mjs + .d.mts）
./gradlew :core:jsBrowserProductionLibraryDistribution

# 2) Web の依存をインストール / install web dependencies
cd web && pnpm install

# 3) Web を起動・ビルド・確認 / dev, build, preview, test
pnpm dev       # 開発サーバ / dev server
pnpm build     # 本番ビルド（dist/ に manifest.webmanifest + Service Worker を生成）
pnpm preview   # dist/ を配信して確認 / serve the production build
pnpm test      # Vitest（Repository ラウンドトリップ・自己修復テスト）
```

> core を変更したら、`web/` で再び消費する前に手順 (1) を再実行してください。
> Re-run step (1) after any change to `core/` before consuming it from `web/`.

## PWA

`web/` は `vite-plugin-pwa`（Workbox）で manifest と Service Worker を自動生成します（手書き SW なし）。
`web/` generates its manifest and service worker via `vite-plugin-pwa` (Workbox) — no hand-written SW.

- `registerType: 'autoUpdate'` — 新バージョンはバックグラウンド更新し、次回読み込みで反映。
- アプリシェル（JS/CSS/HTML/アイコン）を precache し、**オフライン起動**に対応。Kotlin コアは Vite バンドルに同梱され、アプリチャンクの precache でカバーされます。
- SW 登録は `web/src/main.ts` の `virtual:pwa-register` 経由。
- アイコン（`web/public/pwa-192.png`・`pwa-512.png`・`maskable-512.png`）は **仮** のプレースホルダ。

完了条件（最初のリリース）: Web が PWA としてインストール可能・オフライン起動でき、「書く → 保存 → 再度開く」が成立すること（[`docs/ROADMAP.md`](./docs/ROADMAP.md)）。

## 技術スタック / Tech Stack

| 層 | 技術 | バージョン |
|---|---|---|
| Build (core) | Gradle | 9.5 |
| Core | Kotlin Multiplatform | 2.4 |
| Core | kotlinx.serialization | 1.9 |
| Web | Svelte | 5 |
| Web | Vite | 6 |
| Web | vite-plugin-pwa (Workbox) | 0.21 |
| Web | TypeScript | 5 |
| Web | パッケージマネージャ / package manager | pnpm |

## ライセンス / License

未定 / TBD.
