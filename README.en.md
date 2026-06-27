[日本語](./README.md) ・ [**English**](./README.en.md)

# Novel & Light-Novel Writing Editor (noveditor)

<!-- tech-stack:start (auto-generated) -->
<p align="center">
  <img src="https://img.shields.io/badge/Kotlin-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white" alt="Kotlin">
  <img src="https://img.shields.io/badge/Svelte-FF3E00?style=for-the-badge&logo=svelte&logoColor=white" alt="Svelte">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA">
</p>
<!-- tech-stack:end -->

An editor for writing novels and light novels, built around one idea: **"write first, never lose it."**
Save, word-count, and search logic live in a shared **Kotlin Multiplatform** core; **Web/PWA** ships as the first release.
It runs **entirely in the browser** and works offline — what you write stays on your device, and no text is sent to a server.

> Names, icons, and theme colors are **provisional** and will be finalized later.

## Quick start
```sh
./gradlew :core:jsBrowserProductionLibraryDistribution   # 1) build the Kotlin core's JS library
cd web && pnpm install && pnpm dev                        # 2) start the web app → http://localhost:5173/
```
`web/` consumes the core's build output (a JS library) via a local link, so **build the core first**.

## Core experience
- **Write immediately**: open and type. A two-level "novel → episode" structure lets you write in any order.
- **Never lose it**: storage is on-device (localStorage); repository round-trip and self-repair are covered by Vitest.
- **Offline-complete**: installable as a PWA, launches offline, and never sends your text to a server.
- **Stay focused**: character/line counts, focus mode, a paper-like reading theme, and a ⌘K command palette with full-text search.
- **Fore / after notes**: per-episode and novel-wide opening (お知らせ) and closing (あとがき) notes, managed separately from the body (auto-hidden when empty).
- **Markup export**: converts to the markup of Shōsetsuka ni Narō, Kakuyomu, and AlphaPolis for copy / `.txt` export.

## Structure
A 3-layer split: shared core / platform adapters / (future) MCP.

| Directory | Role |
|---|---|
| `core/` | Kotlin Multiplatform shared core: storage model, char/line counts, search, repository port. Platform-independent. |
| `web/` | Web/PWA adapter: TypeScript + Vite + Svelte 5 + vite-plugin-pwa. Consumes the core's JS library. |
| `android/` | Native Android adapter (**future** / next release; will reuse `core/`). |

Specs: [`specs/`](./specs/) · Roadmap: [`docs/ROADMAP.md`](./docs/ROADMAP.md)

## Stack
- **Core**: Kotlin Multiplatform 2.4 + kotlinx.serialization 1.9 (Gradle 9.5, JS library output)
- **Web**: Svelte 5 + Vite 6 + TypeScript 5 (package manager: pnpm)
- **PWA**: vite-plugin-pwa (Workbox) auto-generates the manifest and service worker (no hand-written SW; `registerType: autoUpdate`; app shell precached for offline launch)
- **Tests**: Vitest (repository round-trip, markup export)

## Development

### 1. Toolchain
```sh
# Requires JDK 17+ (for Gradle 9.5) and pnpm
corepack enable    # enable pnpm if needed
```

### 2. Build and test
```sh
./gradlew :core:jsBrowserProductionLibraryDistribution   # 1) build the core (JS library) first
cd web && pnpm install
pnpm build                                               # production build (dist/ with manifest + service worker)
pnpm test                                                # Vitest
```

> After changing `core/`, re-run step 1 before consuming it from `web/` (`pnpm dev -- --force` to pick it up).

> Out of scope for now: vertical writing / book PDF (planned via the author's OSS [tatemd](https://www.npmjs.com/package/tatemd) — not reimplemented here), auto-posting to novel sites (no official API — export stops at markup-converted copy), native Android (next release).

## License
TBD.
