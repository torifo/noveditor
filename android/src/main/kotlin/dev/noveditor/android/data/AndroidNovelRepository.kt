package dev.noveditor.android.data

import dev.noveditor.core.model.Episode
import dev.noveditor.core.model.EpisodeId
import dev.noveditor.core.model.EpisodeSummary
import dev.noveditor.core.model.Novel
import dev.noveditor.core.model.NovelId
import dev.noveditor.core.model.NovelSummary
import dev.noveditor.core.repository.NovelRepository
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer

/**
 * File-backed [NovelRepository] for Android: one JSON file per record under [dir], plus an
 * `index.json` holding the novel index. Ports the web adapter (`LocalStorageNovelRepository`):
 * the same write ordering and the same SELF-HEAL reconciliation.
 *
 * Layout (the app passes `context.filesDir`; tests pass a temp dir):
 *  - `novel-<id>.json`   — one [Novel] (meta + [Novel.episodeOrder])
 *  - `episode-<id>.json` — one [Episode] (body)
 *  - `index.json`        — `List<NovelSummary>` (the novel index)
 *
 * Consistency without cross-file atomicity (same discipline as the web repo):
 *  - [saveNovel] writes the novel body FIRST, then upserts the index — a crash in between leaves
 *    an orphan body, never a dangling index entry.
 *  - [deleteEpisode] removes the body FIRST, then drops the id from the parent order.
 *  - [deleteNovel] removes every episode body FIRST, then the novel body, then the index entry.
 *  - [listNovels] / [listEpisodes] reconcile: drop index entries whose novel body is gone, and
 *    filter [Novel.episodeOrder] ids whose episode body is gone (rewriting the novel).
 * Corrupt/absent JSON is treated as missing — never crashes. All file I/O runs on [Dispatchers.IO].
 */
class AndroidNovelRepository(private val dir: File) : NovelRepository {

    private val indexSerializer = ListSerializer(NovelSummary.serializer())

    private fun novelFile(id: String): File = File(dir, "novel-$id.json")
    private fun episodeFile(id: String): File = File(dir, "episode-$id.json")
    private fun indexFile(): File = File(dir, "index.json")

    // ---- raw helpers (corrupt/absent == missing) ----

    private fun readIndex(): List<NovelSummary> {
        val text = readTextOrNull(indexFile()) ?: return emptyList()
        return try {
            json.decodeFromString(indexSerializer, text)
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun writeIndex(entries: List<NovelSummary>) =
        atomicWrite(indexFile(), json.encodeToString(indexSerializer, entries))

    private fun readNovel(id: String): Novel? {
        val text = readTextOrNull(novelFile(id)) ?: return null
        return try {
            json.decodeFromString(Novel.serializer(), text)
        } catch (_: Exception) {
            null
        }
    }

    private fun readEpisode(id: String): Episode? {
        val text = readTextOrNull(episodeFile(id)) ?: return null
        return try {
            json.decodeFromString(Episode.serializer(), text)
        } catch (_: Exception) {
            null
        }
    }

    private fun hasEpisode(id: EpisodeId): Boolean = episodeFile(id.value).exists()

    private fun writeNovel(novel: Novel) =
        atomicWrite(novelFile(novel.id.value), json.encodeToString(Novel.serializer(), novel))

    /** Upserts the index summary for [novel] (title/updatedAt/episodeCount kept equal to the body). */
    private fun upsertIndex(novel: Novel) {
        val summary = NovelSummary(novel.id, novel.title, novel.episodeOrder.size, novel.updatedAt)
        val entries = readIndex().toMutableList()
        val idx = entries.indexOfFirst { it.id == novel.id }
        if (idx >= 0) entries[idx] = summary else entries.add(summary)
        writeIndex(entries)
    }

    // ---- Novel API ----

    override suspend fun listNovels(): List<NovelSummary> = withContext(Dispatchers.IO) {
        val entries = readIndex()
        val reconciled = mutableListOf<NovelSummary>()
        var changed = false
        for (entry in entries) {
            val novel = readNovel(entry.id.value)
            if (novel == null) {
                // Self-heal: the index references a missing novel body — drop it.
                changed = true
                continue
            }
            // Keep episodeCount in sync with the episodes that still have a body.
            val liveCount = novel.episodeOrder.count { hasEpisode(it) }
            if (entry.episodeCount != liveCount || entry.title != novel.title || entry.updatedAt != novel.updatedAt) {
                changed = true
            }
            reconciled.add(NovelSummary(novel.id, novel.title, liveCount, novel.updatedAt))
        }
        if (changed) writeIndex(reconciled)
        reconciled
    }

    override suspend fun loadNovel(id: NovelId): Novel? = withContext(Dispatchers.IO) {
        readNovel(id.value)
    }

    override suspend fun saveNovel(novel: Novel): Unit = withContext(Dispatchers.IO) {
        // 1. Write the novel body FIRST so the index never references a missing body.
        writeNovel(novel)
        // 2. Upsert the index (title/updatedAt/episodeCount kept equal to the body).
        upsertIndex(novel)
    }

    override suspend fun deleteNovel(id: NovelId): Unit = withContext(Dispatchers.IO) {
        val novel = readNovel(id.value)
        // 1. Remove every episode body FIRST (cascade).
        novel?.episodeOrder?.forEach { episodeFile(it.value).delete() }
        // 2. Remove the novel body.
        novelFile(id.value).delete()
        // 3. Drop the summary from the index.
        val entries = readIndex()
        val next = entries.filter { it.id != id }
        if (next.size != entries.size) writeIndex(next)
    }

    // ---- Episode API ----

    override suspend fun listEpisodes(novelId: NovelId): List<EpisodeSummary> = withContext(Dispatchers.IO) {
        val novel = readNovel(novelId.value) ?: return@withContext emptyList()
        val summaries = mutableListOf<EpisodeSummary>()
        val liveOrder = mutableListOf<EpisodeId>()
        for (id in novel.episodeOrder) {
            val episode = readEpisode(id.value) ?: continue // self-heal: drop dangling order entry
            liveOrder.add(id)
            summaries.add(EpisodeSummary(episode.id, episode.title, episode.updatedAt))
        }
        if (liveOrder.size != novel.episodeOrder.size) {
            val pruned = novel.copy(episodeOrder = liveOrder)
            writeNovel(pruned)
            upsertIndex(pruned)
        }
        summaries
    }

    override suspend fun loadEpisode(id: EpisodeId): Episode? = withContext(Dispatchers.IO) {
        readEpisode(id.value)
    }

    override suspend fun saveEpisode(episode: Episode): Unit = withContext(Dispatchers.IO) {
        // Body only; the parent episodeOrder is owned by the novel (saveNovel).
        atomicWrite(episodeFile(episode.id.value), json.encodeToString(Episode.serializer(), episode))
    }

    override suspend fun deleteEpisode(id: EpisodeId): Unit = withContext(Dispatchers.IO) {
        // Learn the parent novel BEFORE removing the body (the body carries novelId).
        val episode = readEpisode(id.value)
        // 1. Remove the episode body FIRST.
        episodeFile(id.value).delete()
        // 2. Drop the id from the parent novel's episodeOrder.
        val parentId = episode?.novelId ?: findNovelContaining(id) ?: return@withContext
        val novel = readNovel(parentId.value) ?: return@withContext
        if (!novel.episodeOrder.contains(id)) return@withContext
        val next = novel.copy(episodeOrder = novel.episodeOrder.filter { it != id })
        writeNovel(next)
        upsertIndex(next)
    }

    /** Fallback when an episode body is already gone: scan novels for one referencing the id. */
    private fun findNovelContaining(episodeId: EpisodeId): NovelId? {
        for (entry in readIndex()) {
            val novel = readNovel(entry.id.value)
            if (novel != null && novel.episodeOrder.contains(episodeId)) return novel.id
        }
        return null
    }
}
