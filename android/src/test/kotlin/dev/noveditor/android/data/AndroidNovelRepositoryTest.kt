package dev.noveditor.android.data

import dev.noveditor.core.model.Episode
import dev.noveditor.core.model.EpisodeId
import dev.noveditor.core.model.Novel
import dev.noveditor.core.model.NovelId
import java.io.File
import java.nio.file.Files
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pure-JVM unit tests for [AndroidNovelRepository] (no Robolectric — the repo takes a [File], not a
 * Context). Each test gets its own temp dir; suspend methods are driven with [runBlocking].
 */
class AndroidNovelRepositoryTest {

    private fun newDir(): File = Files.createTempDirectory("noveditor").toFile()

    @Test
    fun roundTripsNovelAndEpisodesInOrder() {
        val dir = newDir()
        val repo = AndroidNovelRepository(dir)
        val novelId = NovelId("n1")
        val ep1 = EpisodeId("e1")
        val ep2 = EpisodeId("e2")
        val episode1 = Episode(ep1, novelId, "第一話", "本文1", createdAt = 1, updatedAt = 11, foreNote = "前", afterNote = "後")
        val episode2 = Episode(ep2, novelId, "第二話", "本文2", createdAt = 2, updatedAt = 22)
        val novel = Novel(
            id = novelId,
            title = "作品",
            synopsis = "あらすじ",
            episodeOrder = listOf(ep1, ep2),
            createdAt = 1,
            updatedAt = 33,
            foreNote = "お知らせ",
            afterNote = "あとがき",
        )

        runBlocking {
            repo.saveEpisode(episode1)
            repo.saveEpisode(episode2)
            repo.saveNovel(novel)

            val novels = repo.listNovels()
            assertEquals(1, novels.size)
            assertEquals(novelId, novels[0].id)
            assertEquals("作品", novels[0].title)
            assertEquals(2, novels[0].episodeCount)
            assertEquals(33L, novels[0].updatedAt)

            // Bodies round-trip field-for-field (data-class equality).
            assertEquals(novel, repo.loadNovel(novelId))
            assertEquals(episode1, repo.loadEpisode(ep1))
            assertEquals(episode2, repo.loadEpisode(ep2))

            // Episodes come back in episodeOrder.
            val episodes = repo.listEpisodes(novelId)
            assertEquals(listOf(ep1, ep2), episodes.map { it.id })
            assertEquals(listOf("第一話", "第二話"), episodes.map { it.title })
        }
    }

    @Test
    fun deleteEpisodePrunesEpisodeOrder() {
        val dir = newDir()
        val repo = AndroidNovelRepository(dir)
        val novelId = NovelId("n1")
        val ep1 = EpisodeId("e1")
        val ep2 = EpisodeId("e2")

        runBlocking {
            repo.saveEpisode(Episode(ep1, novelId, "一", "a", 1, 1))
            repo.saveEpisode(Episode(ep2, novelId, "二", "b", 2, 2))
            repo.saveNovel(Novel(novelId, "T", "", listOf(ep1, ep2), 1, 3))

            repo.deleteEpisode(ep1)

            assertNull(repo.loadEpisode(ep1))
            assertEquals(listOf(ep2), repo.loadNovel(novelId)!!.episodeOrder)
            assertEquals(listOf(ep2), repo.listEpisodes(novelId).map { it.id })
            // Index episodeCount tracks the pruned order.
            assertEquals(1, repo.listNovels()[0].episodeCount)
        }
    }

    @Test
    fun deleteNovelCascadesBodiesAndIndex() {
        val dir = newDir()
        val repo = AndroidNovelRepository(dir)
        val novelId = NovelId("n1")
        val ep1 = EpisodeId("e1")
        val ep2 = EpisodeId("e2")

        runBlocking {
            repo.saveEpisode(Episode(ep1, novelId, "一", "a", 1, 1))
            repo.saveEpisode(Episode(ep2, novelId, "二", "b", 2, 2))
            repo.saveNovel(Novel(novelId, "T", "", listOf(ep1, ep2), 1, 3))

            repo.deleteNovel(novelId)

            assertNull(repo.loadNovel(novelId))
            assertNull(repo.loadEpisode(ep1))
            assertNull(repo.loadEpisode(ep2))
            assertTrue(repo.listNovels().isEmpty())
            assertFalse(File(dir, "novel-n1.json").exists())
            assertFalse(File(dir, "episode-e1.json").exists())
            assertFalse(File(dir, "episode-e2.json").exists())
        }
    }

    @Test
    fun listNovelsSelfHealsWhenBodyFileRemoved() {
        val dir = newDir()
        val repo = AndroidNovelRepository(dir)
        val novelId = NovelId("n1")

        runBlocking {
            repo.saveNovel(Novel(novelId, "T", "", emptyList(), 1, 2))
            assertEquals(1, repo.listNovels().size)

            // The body file is lost but the index still references it.
            assertTrue(File(dir, "novel-n1.json").delete())

            // First read drops the dangling entry and rewrites the index; it stays dropped.
            assertTrue(repo.listNovels().isEmpty())
            assertTrue(repo.listNovels().isEmpty())
        }
    }
}
