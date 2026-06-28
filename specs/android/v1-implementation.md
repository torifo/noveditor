# Android v1 — Implementation Decisions (finalized 2026-06-28)

> Supersedes the data-model parts of [design.md](./design.md) / [requirements.md](./requirements.md):
> those were written against the legacy **Manuscript** model. v1 builds on the current
> **Novel → Episode** model (what the web uses), with お知らせ/あとがき (foreNote/afterNote).

## Scope (v1 = "middle")

In: 小説(Novel) → 話(Episode) の作成・編集・自動保存(debounce)＋明示保存・再開・一覧・切替・削除／
文字数・行数(core `countStats`)／オフライン／**お知らせ・あとがき**(話ごと＋小説共通)／**テーマ**(紙・セピア・夜)。

Out (defer to v1.x): ⌘K 全文検索、記法エクスポート(なろう/カクヨム/アルファ)。

## Architecture (finalized)

- **Core reuse**: `:android` depends on the KMP core's **`jvm()`** target (`implementation(project(":core"))`).
  commonMain is pure Kotlin (ids/clock injected by the adapter), so no `androidTarget()` is added to
  core — this keeps the **web Pages CI** free of the Android SDK. Validated: `:android:compileDebugKotlin`
  resolves core's jvm variant; the JS-only build still works without `:android`.
- **`:android` is gated** in `settings.gradle.kts` on `local.properties` existence, so CI without it never
  configures the Android module.
- **UI**: Jetpack Compose + `MaterialTheme`. **State**: a `ViewModel` (StateFlow) mirroring the web's
  `appState` (load → open latest → edit → debounce save → switch/delete).
- **Storage**: `AndroidNovelRepository` implements the core Kotlin port
  `dev.noveditor.core.repository.NovelRepository` (8 suspend methods; **no** `searchEpisodes` — that's web-only)
  using **file + index** in `context.filesDir` (symmetric with the web LocalStorage adapter):
  `novel-<id>.json`, `episode-<id>.json`, `index.json`; serialize the core `@Serializable` models with
  `kotlinx.serialization`. Mirror the web's "write body → update index", "delete body → remove from index",
  and startup index↔body self-repair. Ids = `UUID`, timestamps = `System.currentTimeMillis()`.

## Toolchain / versions (working)

AGP **9.2.1** (AGP 9 has built-in Kotlin — do NOT apply `kotlin.android`), Gradle **9.5**, Kotlin **2.4**,
Compose compiler via `org.jetbrains.kotlin.plugin.compose` (Kotlin 2.4), **Compose BOM 2025.11.01**
(pre-API-37; the 2026.06 BOM needs the not-yet-stable android-37), compileSdk **36**, minSdk **26**,
targetSdk **36**, applicationId **`dev.noveditor`**, namespace `dev.noveditor.android`, label「ノヴェディタ」.
Build with the Android Studio **JBR (JDK 21)**: `JAVA_HOME="…/Android Studio.app/Contents/jbr/Contents/Home"`.

## Files (② parallel phase work-list)

| File | Responsibility |
|---|---|
| `android/src/main/kotlin/dev/noveditor/android/data/AndroidNovelRepository.kt` (+ test) | `NovelRepository` impl: file+index in filesDir, kotlinx.serialization, self-repair. Round-trip + self-repair test (temp dir / Robolectric). |
| `…/data/Persistence.kt` (helpers) | `Json` instance + file read/write helpers (atomic write). |
| `…/AppViewModel.kt` | App state + load/create/save(debounce)/switch/delete; calls the repository; exposes StateFlow. |
| `…/ui/theme/Theme.kt` | 紙/セピア/夜 ColorScheme (port web tokens) + persisted selection. |
| `…/ui/EditorScreen.kt` | 本文＋話タイトル＋文字数/行数(`countStats`)＋お知らせ/あとがき editors. |
| `…/ui/NovelListScreen.kt` | 一覧(タイトル＋更新時刻)・新規・切替・削除。 |
| `MainActivity.kt` | Wire ViewModel + theme + screens (replaces the foundation smoke screen). |

## Build / run

`JAVA_HOME=<JBR> ./gradlew :android:assembleDebug` → `android/build/outputs/apk/debug/`.
Running on an emulator/device may need the user (no emulator currently running).
