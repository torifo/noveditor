package dev.noveditor.android

import android.content.SharedPreferences
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import dev.noveditor.android.ui.theme.ThemeChoice
import dev.noveditor.core.model.Episode
import dev.noveditor.core.model.EpisodeId
import dev.noveditor.core.model.EpisodeSummary
import dev.noveditor.core.model.Novel
import dev.noveditor.core.model.NovelId
import dev.noveditor.core.model.NovelSummary
import dev.noveditor.core.repository.NovelRepository
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Autosave debounce window: edits flush to disk this long after the last keystroke. */
private const val AUTOSAVE_DELAY_MS = 800L

/** Coarse persistence state surfaced to the editor's save indicator. */
enum class SaveStatus { IDLE, DIRTY, SAVING, SAVED, ERROR }

/**
 * Immutable snapshot of the whole editing surface, collected by the screens via [StateFlow].
 *
 * Holds the novel list, the current novel's episode list, the current novel's meta and the
 * editing buffer for the active 話. The buffer is never discarded on a save failure.
 */
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

/**
 * App-wide editing state for the 小説(Novel) → 話(Episode) hierarchy, ported from the web's AppState.
 *
 * Owns the current editing buffer (the active 話's id/title/body/createdAt), the novel list and the
 * current novel's episode list, autosave, and the single save path shared by autosave and the
 * explicit Save button. `updatedAt` is injected here (`System.currentTimeMillis()`) on every save;
 * saving an episode also bumps its parent novel's `updatedAt` so the novel list stays recency-sorted.
 *
 * Startup reads the persisted theme, loads the list, and opens the novel with the max `updatedAt`
 * and its most-recently-updated 話. With no novels it begins empty (the editor shows its CTA).
 */
class AppViewModel(
    private val repository: NovelRepository,
    private val prefs: SharedPreferences,
) : ViewModel() {

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    /** createdAt of the buffered 話, kept off [UiState] so it survives edits and round-trips on save. */
    private var episodeCreatedAt: Long = 0L

    /** Pending debounce save; cancelled+relaunched on each edit, flushed before navigation. */
    private var saveJob: Job? = null

    init {
        val stored = prefs.getString("theme", null)
        val theme =
            if (stored != null) runCatching { ThemeChoice.valueOf(stored) }.getOrDefault(ThemeChoice.PAPER)
            else ThemeChoice.PAPER
        _uiState.update { it.copy(theme = theme) }
        viewModelScope.launch {
            refreshNovels()
            val latest = latestNovel()
            if (latest != null) openNovelInternal(latest.id)
            else clearBuffer()
        }
    }

    // ---- Editing buffer edits (episode) ----

    fun onTitleChange(value: String) {
        _uiState.update { it.copy(title = value) }
        markEdited()
    }

    fun onBodyChange(value: String) {
        _uiState.update { it.copy(body = value) }
        markEdited()
    }

    fun onForeNoteChange(value: String) {
        _uiState.update { it.copy(foreNote = value) }
        markEdited()
    }

    fun onAfterNoteChange(value: String) {
        _uiState.update { it.copy(afterNote = value) }
        markEdited()
    }

    // ---- Novel-meta edits (same debounce path) ----

    fun onNovelTitleChange(value: String) {
        _uiState.update { it.copy(novelTitle = value) }
        markEdited()
    }

    fun onNovelSynopsisChange(value: String) {
        _uiState.update { it.copy(novelSynopsis = value) }
        markEdited()
    }

    fun onNovelForeNoteChange(value: String) {
        _uiState.update { it.copy(novelForeNote = value) }
        markEdited()
    }

    fun onNovelAfterNoteChange(value: String) {
        _uiState.update { it.copy(novelAfterNote = value) }
        markEdited()
    }

    /** Mark the buffer dirty and (re)schedule the debounce save. No-op without an open 話. */
    private fun markEdited() {
        if (_uiState.value.currentEpisodeId == null) return
        _uiState.update { it.copy(saveStatus = SaveStatus.DIRTY, errorMessage = null) }
        scheduleSave()
    }

    private fun scheduleSave() {
        saveJob?.cancel()
        saveJob = viewModelScope.launch {
            delay(AUTOSAVE_DELAY_MS)
            saveNowInternal()
        }
    }

    // ---- Save ----

    /** Explicit save: cancel any pending debounce and flush through the shared save path. */
    fun saveNow() {
        saveJob?.cancel()
        saveJob = null
        viewModelScope.launch { saveNowInternal() }
    }

    /**
     * The single save path (autosave + explicit Save both call this). Persists the current 話 with
     * `updatedAt = now`, then writes the parent novel with the buffer's novel-meta and `updatedAt =
     * now`. The editing buffer is never discarded on failure.
     */
    private suspend fun saveNowInternal() {
        val state = _uiState.value
        val episodeId = state.currentEpisodeId ?: return
        val novelId = state.currentNovelId ?: return
        _uiState.update { it.copy(saveStatus = SaveStatus.SAVING) }
        val now = System.currentTimeMillis()
        val episode = Episode(
            id = episodeId,
            novelId = novelId,
            title = state.title,
            body = state.body,
            createdAt = episodeCreatedAt,
            updatedAt = now,
            foreNote = state.foreNote,
            afterNote = state.afterNote,
        )
        try {
            repository.saveEpisode(episode)
            touchNovel(novelId, now)
            _uiState.update { it.copy(saveStatus = SaveStatus.SAVED, errorMessage = null) }
            refreshNovels()
            refreshEpisodes(novelId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // Do NOT discard the editing buffer on failure.
            fail("保存に失敗しました。編集内容は保持されています。", e)
        }
    }

    /**
     * Persist the current novel's meta with `updatedAt = now`; mirror the episode title onto a
     * still-untitled single-話 novel so 単発 works keep one title.
     */
    private suspend fun touchNovel(novelId: NovelId, now: Long) {
        val novel = repository.loadNovel(novelId) ?: return
        val current = _uiState.value
        val single = novel.episodeOrder.size == 1
        val novelTitle =
            if (single && current.novelTitle.isBlank()) current.title else current.novelTitle
        val next = novel.copy(
            title = novelTitle,
            synopsis = current.novelSynopsis,
            updatedAt = now,
            foreNote = current.novelForeNote,
            afterNote = current.novelAfterNote,
        )
        repository.saveNovel(next)
        if (novelId == _uiState.value.currentNovelId) {
            _uiState.update { it.copy(novelTitle = novelTitle) }
        }
    }

    /** Flush a pending/dirty buffer through the save path before navigating away. */
    private suspend fun persistPending() {
        val state = _uiState.value
        val pending = state.saveStatus == SaveStatus.DIRTY || saveJob?.isActive == true
        if (state.currentEpisodeId != null && pending) {
            saveJob?.cancel()
            saveJob = null
            saveNowInternal()
        }
    }

    // ---- Creation ----

    fun createNovel() {
        viewModelScope.launch { createNovelInternal() }
    }

    /** Create a new 小説 with one empty 話, open it, and select it. */
    private suspend fun createNovelInternal() {
        persistPending()
        try {
            val now = System.currentTimeMillis()
            val novelId = NovelId(UUID.randomUUID().toString())
            val episodeId = EpisodeId(UUID.randomUUID().toString())
            val episode = Episode(
                id = episodeId,
                novelId = novelId,
                title = "",
                body = "",
                createdAt = now,
                updatedAt = now,
            )
            val novel = Novel(
                id = novelId,
                title = "",
                synopsis = "",
                episodeOrder = listOf(episodeId),
                createdAt = now,
                updatedAt = now,
            )
            repository.saveEpisode(episode)
            repository.saveNovel(novel)
            refreshNovels()
            _uiState.update {
                it.copy(
                    currentNovelId = novelId,
                    novelTitle = "",
                    novelSynopsis = "",
                    novelForeNote = "",
                    novelAfterNote = "",
                )
            }
            refreshEpisodes(novelId)
            loadEpisodeInto(episodeId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            fail("小説の作成に失敗しました", e)
        }
    }

    fun createEpisode() {
        viewModelScope.launch { createEpisodeInternal() }
    }

    /** Create a new 話 in the current novel and open it. With no current novel, create a novel. */
    private suspend fun createEpisodeInternal() {
        val novelId = _uiState.value.currentNovelId
        if (novelId == null) {
            createNovelInternal()
            return
        }
        persistPending()
        try {
            val novel = repository.loadNovel(novelId)
            if (novel == null) {
                createNovelInternal()
                return
            }
            val now = System.currentTimeMillis()
            val episodeId = EpisodeId(UUID.randomUUID().toString())
            val episode = Episode(
                id = episodeId,
                novelId = novelId,
                title = "",
                body = "",
                createdAt = now,
                updatedAt = now,
            )
            val next = novel.copy(
                episodeOrder = novel.episodeOrder + episodeId,
                updatedAt = now,
            )
            repository.saveEpisode(episode)
            repository.saveNovel(next)
            refreshNovels()
            refreshEpisodes(novelId)
            loadEpisodeInto(episodeId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            fail("話の作成に失敗しました", e)
        }
    }

    // ---- Navigation ----

    fun openNovel(id: NovelId) {
        viewModelScope.launch { openNovelInternal(id) }
    }

    /** Open a novel and its default 話 (most-recently-updated, else first in order). */
    private suspend fun openNovelInternal(novelId: NovelId) {
        persistPending()
        try {
            val novel = repository.loadNovel(novelId)
            if (novel == null) {
                refreshNovels()
                val latest = latestNovel()
                if (latest != null && latest.id != novelId) openNovelInternal(latest.id)
                else clearBuffer()
                return
            }
            _uiState.update {
                it.copy(
                    currentNovelId = novel.id,
                    novelTitle = novel.title,
                    novelSynopsis = novel.synopsis,
                    novelForeNote = novel.foreNote,
                    novelAfterNote = novel.afterNote,
                )
            }
            refreshEpisodes(novel.id)
            val target = defaultEpisodeId()
            if (target != null) {
                loadEpisodeInto(target)
            } else {
                clearEpisodeBuffer()
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            fail("小説の読み込みに失敗しました", e)
        }
    }

    fun openEpisode(id: EpisodeId) {
        viewModelScope.launch { openEpisodeInternal(id) }
    }

    /** Switch to another 話 within the current novel (autosave current first). */
    private suspend fun openEpisodeInternal(episodeId: EpisodeId) {
        val state = _uiState.value
        if (episodeId == state.currentEpisodeId && state.saveStatus != SaveStatus.DIRTY) return
        persistPending()
        loadEpisodeInto(episodeId)
    }

    /** Load an episode into the buffer WITHOUT persisting the current one (caller handles that). */
    private suspend fun loadEpisodeInto(episodeId: EpisodeId) {
        try {
            val ep = repository.loadEpisode(episodeId)
            if (ep == null) {
                // Vanished — refresh the episode list and fall back to a sibling.
                val currentNovelId = _uiState.value.currentNovelId
                if (currentNovelId != null) refreshEpisodes(currentNovelId)
                val fallback = defaultEpisodeId()
                if (fallback != null && fallback != episodeId) {
                    loadEpisodeInto(fallback)
                } else {
                    clearEpisodeBuffer()
                }
                return
            }
            episodeCreatedAt = ep.createdAt
            _uiState.update {
                it.copy(
                    currentNovelId = ep.novelId,
                    currentEpisodeId = ep.id,
                    title = ep.title,
                    body = ep.body,
                    foreNote = ep.foreNote,
                    afterNote = ep.afterNote,
                    saveStatus = SaveStatus.IDLE,
                    errorMessage = null,
                )
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            fail("話の読み込みに失敗しました", e)
        }
    }

    // ---- Deletion (no undo in v1) ----

    fun removeEpisode(id: EpisodeId) {
        viewModelScope.launch { removeEpisodeInternal(id) }
    }

    /** Delete a 話; if it was current, move to a sibling (else the latest novel, else empty). */
    private suspend fun removeEpisodeInternal(episodeId: EpisodeId) {
        val novelId = _uiState.value.currentNovelId
        try {
            repository.deleteEpisode(episodeId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            fail("削除に失敗しました", e)
            return
        }
        refreshNovels()
        if (novelId != null) refreshEpisodes(novelId)
        if (episodeId == _uiState.value.currentEpisodeId) {
            saveJob?.cancel()
            saveJob = null
            val fallback = defaultEpisodeId()
            if (fallback != null) {
                loadEpisodeInto(fallback)
            } else {
                val latest = latestNovel()
                if (latest != null) openNovelInternal(latest.id)
                else clearBuffer()
            }
        }
    }

    fun removeNovel(id: NovelId) {
        viewModelScope.launch { removeNovelInternal(id) }
    }

    /** Delete a 小説 and all its 話; if it was current, move to the latest remaining novel. */
    private suspend fun removeNovelInternal(novelId: NovelId) {
        try {
            repository.deleteNovel(novelId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            fail("削除に失敗しました", e)
            return
        }
        refreshNovels()
        if (novelId == _uiState.value.currentNovelId) {
            saveJob?.cancel()
            saveJob = null
            val latest = latestNovel()
            if (latest != null) openNovelInternal(latest.id)
            else clearBuffer()
        }
    }

    // ---- Theme ----

    fun setTheme(choice: ThemeChoice) {
        _uiState.update { it.copy(theme = choice) }
        prefs.edit().putString("theme", choice.name).apply()
    }

    // ---- Helpers ----

    private suspend fun refreshNovels() {
        try {
            val list = repository.listNovels().sortedByDescending { it.updatedAt }
            _uiState.update { it.copy(novels = list) }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            fail("小説一覧の読み込みに失敗しました", e)
        }
    }

    private suspend fun refreshEpisodes(novelId: NovelId) {
        try {
            val list = repository.listEpisodes(novelId)
            _uiState.update { it.copy(episodes = list) }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            fail("話一覧の読み込みに失敗しました", e)
        }
    }

    /** The latest novel by `updatedAt`, or `null` when there are none. */
    private fun latestNovel(): NovelSummary? =
        _uiState.value.novels.maxByOrNull { it.updatedAt }

    /** The default 話 for the current novel: latest `updatedAt`, else first in order, else `null`. */
    private fun defaultEpisodeId(): EpisodeId? =
        _uiState.value.episodes.maxByOrNull { it.updatedAt }?.id

    /** Clear only the 話 buffer (the novel stays open with no episode). */
    private fun clearEpisodeBuffer() {
        episodeCreatedAt = 0L
        _uiState.update {
            it.copy(
                currentEpisodeId = null,
                title = "",
                body = "",
                foreNote = "",
                afterNote = "",
                saveStatus = SaveStatus.IDLE,
            )
        }
    }

    /** Clear the whole editing buffer (no novel/episode open). Keeps the novel list and theme. */
    private fun clearBuffer() {
        episodeCreatedAt = 0L
        _uiState.update {
            it.copy(
                currentNovelId = null,
                currentEpisodeId = null,
                episodes = emptyList(),
                novelTitle = "",
                novelSynopsis = "",
                novelForeNote = "",
                novelAfterNote = "",
                title = "",
                body = "",
                foreNote = "",
                afterNote = "",
                saveStatus = SaveStatus.IDLE,
                errorMessage = null,
            )
        }
    }

    private fun fail(message: String, cause: Throwable) {
        Log.e("noveditor", message, cause)
        _uiState.update { it.copy(saveStatus = SaveStatus.ERROR, errorMessage = message) }
    }

    companion object {
        fun factory(
            repository: NovelRepository,
            prefs: SharedPreferences,
        ): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T =
                AppViewModel(repository, prefs) as T
        }
    }
}
