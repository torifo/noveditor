[**日本語**](./README.md) ・ [English](./README.en.md)

# 小説・ラノベ執筆エディタ(noveditor)

<!-- tech-stack:start (auto-generated) -->
<p align="center">
  <img src="https://img.shields.io/badge/Kotlin-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white" alt="Kotlin">
  <img src="https://img.shields.io/badge/Svelte-FF3E00?style=for-the-badge&logo=svelte&logoColor=white" alt="Svelte">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA">
  <img src="https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white" alt="Android">
  <img src="https://img.shields.io/badge/Jetpack%20Compose-4285F4?style=for-the-badge&logo=jetpackcompose&logoColor=white" alt="Jetpack Compose">
</p>
<!-- tech-stack:end -->

小説・ライトノベル・エッセイといった、**文章を書くことに特化**した執筆エディタ。
汎用のテキストエディタではなく、**「書く」という行為そのもの**に最適化することを趣旨とする。
保存・文字数・検索などのロジックを **Kotlin Multiplatform** の共有コアに集約し、**Web/PWA** を最初のリリースとして公開するモノレポ。
**ブラウザだけで完結**し、オフラインでも執筆できる(書いたものは端末内に残り、本文をサーバへ送らない)。

<p align="center">
  <img src="./docs/screenshot.png" alt="ノヴェディタ（Web）の画面" width="860">
</p>

## クイックスタート
```sh
./gradlew :core:jsBrowserProductionLibraryDistribution   # ① Kotlin コアの JS ライブラリを生成
cd web && pnpm install && pnpm dev                        # ② Web を起動 → http://localhost:5173/
```
`web/` は `core/` のビルド出力(JS ライブラリ)をローカルリンクで消費するため、**必ず core を先にビルド**する。

## コア体験
- **小説向けの構造**: 「小説 → 話(エピソード)」の 2 階層で長編を管理し、思いついた順に書き進められる。
- **消えない**: 保存は端末内(localStorage)。Repository ラウンドトリップと自己修復を Vitest で担保。
- **オフライン完結**: PWA としてインストール可能・オフライン起動可能。本文をサーバへ送らない。
- **執筆に集中**: 文字数/行数カウント・集中モード・紙のような本文テーマ・⌘K コマンドパレット＋全文検索。
- **お知らせ／あとがき**: 話ごと＋小説共通の冒頭(お知らせ)・末尾(あとがき)を本文と分けて管理(空なら自動で隠す)。
- **記法エクスポート**: 小説家になろう・カクヨム・アルファポリス向けの記法へ変換し、コピー / `.txt` 出力。

## 構成
3 層分離(共有コア／プラットフォームアダプタ／将来の MCP)を採用。

| ディレクトリ | 役割 |
|---|---|
| `core/` | Kotlin Multiplatform 共有コア。保存モデル・文字数/行数・検索・Repository port。プラットフォーム非依存。 |
| `web/` | Web/PWA アダプタ。TypeScript + Vite + Svelte 5 + vite-plugin-pwa。`core/` の JS ライブラリを消費。 |
| `android/` | ネイティブ Android アダプタ(**Jetpack Compose**)。**v1 実装済み**(`core/` を `jvm()` ターゲットで再利用・`:android:assembleDebug` 成功・ユニットテスト green)。実機検証とリリースは保留。 |

仕様: [`specs/`](./specs/) ・ ロードマップ: [`docs/ROADMAP.md`](./docs/ROADMAP.md)

## スタック
- **コア**: Kotlin Multiplatform 2.4 ＋ kotlinx.serialization 1.9(Gradle 9.5・JS ライブラリ出力)
- **Web**: Svelte 5 ＋ Vite 6 ＋ TypeScript 5(パッケージマネージャ: pnpm)
- **PWA**: vite-plugin-pwa(Workbox)が manifest と Service Worker を自動生成(手書き SW なし・`registerType: 'prompt'`＝新バージョンは通知し「更新」操作で適用・アプリシェルを precache してオフライン起動)
- **Android**: Jetpack Compose ＋ Material 3(AGP 9.2・Compose BOM・`core/` を `jvm()` ターゲットで再利用)
- **テスト**: Vitest(Web/core の Repository ラウンドトリップ・記法エクスポート)＋ JUnit(Android の Repository)

## 開発セットアップ

### 1. ツールチェーン
```sh
# 必要: JDK 17+(Gradle 9.5 用) と pnpm
corepack enable    # pnpm を有効化(未導入の場合)
```

### 2. ビルドとテスト
```sh
./gradlew :core:jsBrowserProductionLibraryDistribution   # ① コア(JS ライブラリ)を先にビルド
cd web && pnpm install
pnpm build                                               # 本番ビルド(dist/ に manifest + Service Worker)
pnpm test                                                # Vitest
```

> `core/` を変更したら、`web/` で消費する前に ① を再実行する(`pnpm dev -- --force` で取り込み)。

> **Android(v1)** のビルドには `local.properties`(SDK パス)と Android Studio の JBR(JDK 21)が必要(`JAVA_HOME=<JBR> ./gradlew :android:assembleDebug`)。`:android` は `local.properties` がある時だけ構成され、Web の Pages CI には無影響。詳細は [`specs/android/`](./specs/android/)。

> 現在の対象外: 縦書き・書籍 PDF(自作 OSS [tatemd](https://www.npmjs.com/package/tatemd) 連携で将来提供／自前実装しない)、各小説投稿サイトへの自動投稿(公式 API なし・記法変換コピーまで)。

## ライセンス
[MIT](./LICENSE) © 2026 torifo
