# Android v1 — Parallel Implementation Contract (frozen)

This is the **single source of truth** that lets five independently-written files compile
together. Implement the exact names/signatures below — do not rename or change shapes.

App module: `:android`. Base package: `dev.noveditor.android`. Min/target/compile SDK 26/36/36.
UI = Jetpack Compose + Material3. Build runs later by the coordinator — just make the code correct.

## Hard constraints (every file)

- **Do NOT apply / assume the `org.jetbrains.kotlin.android` plugin.** AGP 9 has built-in Kotlin.
- Package is under `dev.noveditor.android.*`. Core (already built) is `dev.noveditor.core.*`.
- Reuse the KMP **core** as-is; do **not** add new `@Serializable` classes in `:android`.
  Serialize core models with their generated serializers (see Persistence below).
- Compose: collect state with `androidx.compose.runtime.collectAsState()` (no lifecycle-compose dep).
  Prefer **text/emoji labels** over `Icons.*` (no extended-icons dependency available).
  Any `TopAppBar` / other Material3 experimental API needs `@OptIn(ExperimentalMaterial3Api::class)`.
- v1 OUT of scope (do NOT implement): full-text search, export, episode reorder, sample/guide
  seeding, legacy migration, delete-undo. Keep it to what's listed here.
- No Claude/Anthropic attribution anywhere (comments included).

## Core API you build on (already exists — `dev.noveditor.core.*`, read the real files)

Models (`core/.../model/Novel.kt`, `DocumentStats.kt`):
- `@JvmInline value class NovelId(val value: String)`, `EpisodeId(val value: String)` (both `@Serializable`).
- `data class Novel(id: NovelId, title: String, synopsis: String = "", episodeOrder: List<EpisodeId>, createdAt: Long, updatedAt: Long, foreNote: String = "", afterNote: String = "")`
- `data class Episode(id: EpisodeId, novelId: NovelId, title: String, body: String, createdAt: Long, updatedAt: Long, foreNote: String = "", afterNote: String = "")`
- `data class NovelSummary(id: NovelId, title: String, episodeCount: Int, updatedAt: Long)`
- `data class EpisodeSummary(id: EpisodeId, title: String, updatedAt: Long)`
- `data class DocumentStats(charCount: Int, charCountNoWhitespace: Int, lineCount: Int, paragraphCount: Int)`

Stats (`core/.../stats/CountStats.kt`): `fun countStats(text: String): DocumentStats` (pure).

Repository port (`core/.../repository/NovelRepository.kt`) — 8 `suspend` methods, **no** searchEpisodes:
```
interface NovelRepository {
  suspend fun listNovels(): List<NovelSummary>            // empty list, never null
  suspend fun loadNovel(id: NovelId): Novel?
  suspend fun saveNovel(novel: Novel)                     // upsert by id
  suspend fun deleteNovel(id: NovelId)                    // cascade-delete its episodes; no-op if absent
  suspend fun listEpisodes(novelId: NovelId): List<EpisodeSummary>  // in Novel.episodeOrder order
  suspend fun loadEpisode(id: EpisodeId): Episode?
  suspend fun saveEpisode(episode: Episode)              // writes body only; order owned by Novel
  suspend fun deleteEpisode(id: EpisodeId)               // also drops id from parent Novel.episodeOrder
}
```
Ordering is owned by `Novel.episodeOrder` (episodes carry no order field). `core` holds no clock and
mints no ids — the caller (ViewModel) supplies `updatedAt`/`createdAt` and ids.

---

## SHARED TYPES (these names are referenced across files — match exactly)

### `ThemeChoice` — defined in `ui/theme/Theme.kt` (Agent: Theme), imported by ViewModel & MainActivity
```kotlin
package dev.noveditor.android.ui.theme
enum class ThemeChoice { PAPER, SEPIA, NIGHT }   // 紙 / セピア / 夜
```

### `SaveStatus` — defined in `AppViewModel.kt` (Agent: ViewModel)
```kotlin
enum class SaveStatus { IDLE, DIRTY, SAVING, SAVED, ERROR }
```

### `UiState` — defined in `AppViewModel.kt` (Agent: ViewModel); read by both screens & MainActivity
```kotlin
import dev.noveditor.core.model.NovelId
import dev.noveditor.core.model.EpisodeId
import dev.noveditor.core.model.NovelSummary
import dev.noveditor.core.model.EpisodeSummary
import dev.noveditor.android.ui.theme.ThemeChoice

data class UiState(
    val novels: List<NovelSummary> = emptyList(),      // sorted by updatedAt DESC
    val episodes: List<EpisodeSummary> = emptyList(),  // current novel's episodes, in episodeOrder
    val currentNovelId: NovelId? = null,
    val currentEpisodeId: EpisodeId? = null,
    // current novel meta
    val novelTitle: String = "",
    val novelSynopsis: String = "",
    val novelForeNote: String = "",     // 小説共通お知らせ
    val novelAfterNote: String = "",    // 小説共通あとがき
    // editing buffer for the current episode
    val title: String = "",             // 話タイトル
    val body: String = "",
    val foreNote: String = "",          // 話ごとお知らせ
    val afterNote: String = "",         // 話ごとあとがき
    val saveStatus: SaveStatus = SaveStatus.IDLE,
    val errorMessage: String? = null,
    val theme: ThemeChoice = ThemeChoice.PAPER,
) {
    val hasEpisode: Boolean get() = currentEpisodeId != null
}
```

### `AppViewModel` — defined in `AppViewModel.kt` (Agent: ViewModel)
```kotlin
class AppViewModel(
    private val repository: dev.noveditor.core.repository.NovelRepository,
    private val prefs: android.content.SharedPreferences,
) : androidx.lifecycle.ViewModel() {

    val uiState: kotlinx.coroutines.flow.StateFlow<UiState>   // backed by MutableStateFlow

    // The VM self-initializes in an init{} block: read persisted theme from prefs, load the novel
    // list, then open the most-recently-updated novel and its most-recently-updated episode
    // (empty buffer if there are no novels). No public start() needed.

    // episode-buffer edits  (each: update state, set saveStatus=DIRTY, schedule 800ms debounce save)
    fun onTitleChange(value: String)
    fun onBodyChange(value: String)
    fun onForeNoteChange(value: String)
    fun onAfterNoteChange(value: String)
    // novel-meta edits  (same debounce path)
    fun onNovelTitleChange(value: String)
    fun onNovelSynopsisChange(value: String)
    fun onNovelForeNoteChange(value: String)
    fun onNovelAfterNoteChange(value: String)

    fun saveNow()                       // explicit save = same path as the debounce target

    fun createNovel()                   // new novel + one empty episode; open & select it
    fun createEpisode()                 // new episode in current novel (or createNovel() if none)

    fun openNovel(id: NovelId)          // autosave pending first, then open novel + default episode
    fun openEpisode(id: EpisodeId)      // autosave pending first, then switch episode

    fun removeNovel(id: NovelId)        // delete (UI confirms first); if current, fall back to latest
    fun removeEpisode(id: EpisodeId)    // delete (UI confirms first); if current, fall back to sibling

    fun setTheme(choice: ThemeChoice)   // update state + persist to prefs (key "theme" = name)

    companion object {
        fun factory(
            repository: dev.noveditor.core.repository.NovelRepository,
            prefs: android.content.SharedPreferences,
        ): androidx.lifecycle.ViewModelProvider.Factory
    }
}
```

### Theme composable — `ui/theme/Theme.kt` (Agent: Theme)
```kotlin
@Composable
fun NoveditorTheme(choice: ThemeChoice, content: @Composable () -> Unit)
```

### Screen composables (Agents: Editor, NovelList) — stateless, take the VM + one nav lambda
```kotlin
@Composable
fun EditorScreen(vm: AppViewModel, onOpenNovelList: () -> Unit, modifier: Modifier = Modifier)

@Composable
fun NovelListScreen(vm: AppViewModel, onNovelOpened: () -> Unit, modifier: Modifier = Modifier)
```
Each screen does `val state by vm.uiState.collectAsState()` and calls VM methods. `onOpenNovelList`
opens the drawer (MainActivity owns it); `onNovelOpened` is called after a novel is opened so the
drawer can close.

---

## ViewModel save/navigation semantics (Agent: ViewModel — mirror the web's AppState)

Reference (do not import): `web/src/state/appState.svelte.ts`. Behaviors to reproduce:
- **Single save path** `saveNow()`: build `Episode` from the buffer with `updatedAt = now`, call
  `saveEpisode`; then load the parent novel and `saveNovel` it with the buffer's novel-meta
  (title/synopsis/foreNote/afterNote), unchanged `episodeOrder`, `updatedAt = now`. For a
  single-episode novel whose title is still blank, mirror the episode title onto the novel title.
  Set `saveStatus=SAVING`→`SAVED`; on failure set `ERROR`+`errorMessage`, **never discard the buffer**.
  Then refresh the novel list (sorted updatedAt desc) and the current novel's episode list.
- **Debounce** 800ms via `viewModelScope` + a cancellable `Job` (`delay` then `saveNow`).
  Any edit handler: cancel+reschedule, set `saveStatus=DIRTY`. Flush pending before any navigation.
- **createNovel**: mint `NovelId`/`EpisodeId` = `NovelId(java.util.UUID.randomUUID().toString())`,
  `now = System.currentTimeMillis()`. Save the empty episode, then the novel with
  `episodeOrder=[episodeId]`; refresh; open it; buffer = the new episode.
- **createEpisode**: load current novel, append a new `EpisodeId` to `episodeOrder`, save episode +
  novel (updatedAt=now); refresh; open the new episode. If no current novel → `createNovel()`.
- **openNovel**: flush pending; load novel; set novel-meta; refresh episodes; open the default
  episode = max `updatedAt`, else first in order; empty buffer if none.
- **openEpisode**: flush pending; load episode into buffer; `saveStatus=IDLE`.
- **removeEpisode / removeNovel**: flush nothing; call repo delete; refresh; if the deleted item was
  current, fall back (episode → default sibling; novel → latest remaining novel, else empty buffer).
  (No undo in v1.)
- Ids: `UUID`. Timestamps: `System.currentTimeMillis()`. Use `viewModelScope.launch` for all repo I/O.

---

## Persistence (Agent: Data) — `data/Persistence.kt` + `data/AndroidNovelRepository.kt` (+ test)

`AndroidNovelRepository(private val dir: java.io.File) : NovelRepository`
Storage = file + index in `dir` (the caller passes `context.filesDir`; the test passes a temp dir):
- `novel-<id>.json`  → one `Novel`
- `episode-<id>.json` → one `Episode`
- `index.json`       → `List<NovelSummary>` (the novel index)

`Persistence.kt` provides:
- `val json = Json { ignoreUnknownKeys = true; prettyPrint = false }` (`kotlinx.serialization.json.Json`)
- atomic write helper: write to `<name>.tmp` then `renameTo(<name>)`; read helper returns `null` if absent.

Serialize with **core's generated serializers** (no `:android` serialization plugin):
```kotlin
import kotlinx.serialization.builtins.ListSerializer
json.encodeToString(Novel.serializer(), novel)
json.decodeFromString(Novel.serializer(), text)
json.encodeToString(ListSerializer(NovelSummary.serializer()), index)
```
Mirror the web adapter (`web/src/repository/LocalStorageNovelRepository.ts`) exactly:
- `saveNovel`: write novel body FIRST, then upsert the index summary
  (`NovelSummary(id, title, episodeOrder.size, updatedAt)`).
- `saveEpisode`: write episode body only.
- `deleteNovel`: remove all episode bodies, then the novel body, then the index entry.
- `deleteEpisode`: read episode to learn `novelId`, remove episode body, then drop the id from the
  parent `Novel.episodeOrder` (rewrite novel + upsert index).
- `listNovels`: read index; **self-heal** — drop entries whose novel body is missing; recompute
  `episodeCount` = live episodes; rewrite index if it changed; return sorted-by-caller (return as-is).
- `listEpisodes`: read novel; return summaries in `episodeOrder`, skipping ids with no body;
  if any were dropped, rewrite the novel with the pruned order (+ upsert index).
- Corrupt/absent JSON is treated as missing (catch, return null/empty) — never crash.
Make all 8 methods `suspend` and do file I/O on `kotlinx.coroutines.Dispatchers.IO` (`withContext`).

**Test** (`android/src/test/.../data/AndroidNovelRepositoryTest.kt`, Robolectric or pure-JVM with a
`createTempDir()`): round-trip a novel + episodes (save→list→load equal), episode delete prunes the
order, novel delete cascades, and self-heal drops an index entry whose body file was removed. Use
`kotlinx.coroutines.test.runTest` (or `runBlocking`). The coordinator wires test deps in Gradle — just
write idiomatic JUnit. Name the test class `AndroidNovelRepositoryTest`.

---

## Theme tokens (Agent: Theme) — port these web CSS values into 3 Material3 ColorSchemes

Map: `background = paper`, `surface = surface`, `surfaceVariant = surface-sunken`,
`onBackground/onSurface = ink`, `onSurfaceVariant = ink-soft`, `primary = accent`,
`onPrimary = accent-contrast`, `primaryContainer = accent-wash`, `onPrimaryContainer = ink`.
Use `lightColorScheme(...)` for PAPER & SEPIA, `darkColorScheme(...)` for NIGHT. `Color(0xFF......)`.

| token | PAPER (紙) | SEPIA (セピア) | NIGHT (夜) |
|---|---|---|---|
| paper | #f6f3ec | #f3ead8 | #1a1916 |
| surface | #fdfbf7 | #f7f0e1 | #232220 |
| surface-sunken | #f1ece2 | #ebdfc8 | #2c2a26 |
| ink | #23202b | #3a2e20 | #ece7df |
| ink-soft | #4a4654 | #5b4a37 | #c5beb1 |
| ink-muted | #6b6675 | #6f5c45 | #9c9488 |
| accent | #7f52ff | #6e44e8 | #b29dff |
| accent-strong | #6a3df0 | #5a32cf | #c8baff |
| accent-wash | #f0ebff | #e8dcf3 | #2a2542 |
| accent-contrast | #ffffff | #ffffff | #1a1916 |

`NoveditorTheme(choice, content)` selects the scheme by `choice` and wraps `MaterialTheme(colorScheme = …) { content() }`.

---

## Screen details

### EditorScreen (Agent: Editor)
- Top bar: a button calling `onOpenNovelList` (label "☰" or "作品"), the current novel title
  (`state.novelTitle`, "（無題）" if blank), a save indicator from `state.saveStatus`
  (idle/dirty/saving/saved/error → e.g. "" / "未保存" / "保存中…" / "保存済み" / "保存失敗"), and an
  explicit save button → `vm.saveNow()`.
- Episode selector for the current novel: a row/section listing `state.episodes` (title or "（無題）" +
  relative/short updatedAt), highlighting `state.currentEpisodeId`; tapping → `vm.openEpisode(id)`;
  a "＋新規話" → `vm.createEpisode()`; per-episode delete (with an AlertDialog confirm) → `vm.removeEpisode(id)`.
- Main editor: 話タイトル `OutlinedTextField(state.title, vm::onTitleChange)`; body
  `OutlinedTextField(state.body, vm::onBodyChange)` (multiline, fills height); below it show counts
  from `countStats(state.body)`: "${charCount}字 / ${lineCount}行" (charCountNoWhitespace optional).
  IME-composition exclusion from counts is best-effort/deferred — just count `state.body`.
- Collapsible "お知らせ・あとがき" section: episode `foreNote`/`afterNote`
  (`vm::onForeNoteChange`/`onAfterNoteChange`) and 小説共通 `novelForeNote`/`novelAfterNote`
  (`vm::onNovelForeNoteChange`/`onNovelAfterNoteChange`). A small novel-title field
  (`state.novelTitle`, `vm::onNovelTitleChange`) may live here too. Synopsis optional.
- A theme switcher (3 choices) → `vm.setTheme(...)` (segmented buttons / simple row is fine).
- Empty state (`!state.hasEpisode`): a centered CTA button "新しい小説を書く" → `vm.createNovel()`.

### NovelListScreen (Agent: NovelList)
- Header "作品" + a "＋新規作成" button → `vm.createNovel()` then `onNovelOpened()`.
- List `state.novels`: each row = title ("（無題の小説）" if blank) + "${episodeCount}話" +
  short updatedAt; highlight `state.currentNovelId`. Tap a row → `vm.openNovel(id)` then `onNovelOpened()`.
- Per-row delete (trailing button) with an AlertDialog confirm → `vm.removeNovel(id)` (stay in the list).
- Empty state: a short hint + "＋新規作成".
- Format updatedAt with `java.text.SimpleDateFormat("M/d HH:mm", java.util.Locale.JAPAN)` (or similar).

---

## Wiring (Coordinator, not an agent) — MainActivity hosts:
`ModalNavigationDrawer` with `NovelListScreen(vm, onNovelOpened = { close drawer })` in the sheet and
`EditorScreen(vm, onOpenNovelList = { open drawer })` as content, all wrapped in
`NoveditorTheme(choice = state.theme)`. VM built via `AppViewModel.factory(AndroidNovelRepository(filesDir), getSharedPreferences("noveditor", MODE_PRIVATE))`.
