package dev.noveditor.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.noveditor.android.AppViewModel
import dev.noveditor.core.model.NovelId
import dev.noveditor.core.model.NovelSummary
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** 小説タイトルが空のときの表示（話の無題「（無題）」と区別する）。 */
private const val UNTITLED_NOVEL = "（無題の小説）"

/** 一覧の更新日時を「M/d HH:mm」で短く表示する。 */
private fun formatUpdatedAt(timestamp: Long): String =
    SimpleDateFormat("M/d HH:mm", Locale.JAPAN).format(Date(timestamp))

/**
 * 作品（小説）の一覧。新規作成・選択・削除を担う、ドロワー内のスクリーン。
 *
 * 状態は [AppViewModel] のみが持ち、本コンポーザブルはステートレス。行をタップすると
 * その小説を開いて [onNovelOpened]（ドロワーを閉じる）を呼ぶ。削除は確認ダイアログを挟み、
 * 一覧に留まる（[onNovelOpened] は呼ばない）。
 */
@Composable
fun NovelListScreen(
    vm: AppViewModel,
    onNovelOpened: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by vm.uiState.collectAsState()

    // 削除確認ダイアログ対象の小説。null のとき非表示。
    var pendingDelete by remember { mutableStateOf<NovelId?>(null) }

    // 「＋新規作成」: 新規小説を作って開き、ドロワーを閉じる。
    val onCreate: () -> Unit = {
        vm.createNovel()
        onNovelOpened()
    }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // ---- ヘッダー: タイトル + 新規作成 ----
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "作品",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Spacer(Modifier.weight(1f))
                Button(onClick = onCreate) {
                    Text("＋新規作成")
                }
            }

            if (state.novels.isEmpty()) {
                // ---- 空状態 ----
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "まだ作品がありません",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = onCreate) {
                            Text("＋新規作成")
                        }
                    }
                }
            } else {
                // ---- 一覧 ----
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    items(state.novels, key = { it.id.value }) { n ->
                        NovelRow(
                            summary = n,
                            isCurrent = n.id == state.currentNovelId,
                            onOpen = {
                                vm.openNovel(n.id)
                                onNovelOpened()
                            },
                            onRequestDelete = { pendingDelete = n.id },
                        )
                    }
                }
            }
        }
    }

    // ---- 削除確認ダイアログ ----
    val pending = pendingDelete
    if (pending != null) {
        val pendingTitle = state.novels.firstOrNull { it.id == pending }
            ?.let { if (it.title.isBlank()) UNTITLED_NOVEL else it.title }
            ?: UNTITLED_NOVEL
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("削除しますか？") },
            text = { Text("「$pendingTitle」とそのすべての話を削除します。元に戻せません。") },
            confirmButton = {
                TextButton(
                    onClick = {
                        vm.removeNovel(pending)
                        pendingDelete = null
                    },
                ) {
                    Text("削除")
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) {
                    Text("キャンセル")
                }
            },
        )
    }
}

/**
 * 一覧の1行。タイトル・話数・更新日時を表示し、現在開いている小説は背景を着色して示す。
 * 末尾に削除ボタン（タップで確認ダイアログを開く）。
 */
@Composable
private fun NovelRow(
    summary: NovelSummary,
    isCurrent: Boolean,
    onOpen: () -> Unit,
    onRequestDelete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val title = if (summary.title.isBlank()) UNTITLED_NOVEL else summary.title
    Surface(
        onClick = onOpen,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = if (isCurrent) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surface
        },
    ) {
        Row(
            modifier = Modifier.padding(start = 16.dp, top = 10.dp, end = 4.dp, bottom = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = if (isCurrent) FontWeight.SemiBold else FontWeight.Normal,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "${summary.episodeCount}話 ・ ${formatUpdatedAt(summary.updatedAt)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            IconButton(onClick = onRequestDelete) {
                Text("🗑")
            }
        }
    }
}
