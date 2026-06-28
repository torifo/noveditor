package dev.noveditor.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import dev.noveditor.android.AppViewModel
import dev.noveditor.android.SaveStatus
import dev.noveditor.android.ui.theme.ThemeChoice
import dev.noveditor.core.model.EpisodeId
import dev.noveditor.core.stats.countStats

/**
 * 執筆画面（1話分のエディタ）。上部バー・話セレクタ・本文・お知らせ/あとがき・テーマ切替を持つ。
 * 状態は [AppViewModel] が単一の真実の源として保持し、本画面はステートレスに描画する。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorScreen(
    vm: AppViewModel,
    onOpenNovelList: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by vm.uiState.collectAsState()

    // 話削除の確認ダイアログ対象（null = 非表示）。
    var episodeToDelete by remember { mutableStateOf<EpisodeId?>(null) }
    // 「お知らせ・あとがき」セクションの開閉。
    var notesExpanded by remember { mutableStateOf(false) }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = state.novelTitle.ifBlank { "（無題）" },
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
                navigationIcon = {
                    TextButton(onClick = onOpenNovelList) { Text("☰") }
                },
                actions = {
                    val saveLabel = saveStatusLabel(state.saveStatus)
                    if (saveLabel.isNotEmpty()) {
                        Text(
                            text = saveLabel,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 8.dp),
                        )
                    }
                    TextButton(onClick = { vm.saveNow() }) { Text("保存") }
                },
            )
        },
    ) { padding ->
        if (!state.hasEpisode) {
            // 空状態: まだ小説/話が無い。中央に案内とCTA。
            Column(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = "最初の小説を始めましょう",
                    style = MaterialTheme.typography.headlineSmall,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "思いついた一行から、すぐに書き始められます。一話完結でも、連載でも。",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(20.dp))
                Button(onClick = { vm.createNovel() }) { Text("新しい小説を書く") }
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .padding(horizontal = 16.dp),
        ) {
            // ---- 話セレクタ（横スクロール）----
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                state.episodes.forEach { ep ->
                    EpisodeChip(
                        label = ep.title.ifBlank { "（無題）" },
                        selected = ep.id == state.currentEpisodeId,
                        onSelect = { vm.openEpisode(ep.id) },
                        onDelete = { episodeToDelete = ep.id },
                    )
                }
                TextButton(onClick = { vm.createEpisode() }) { Text("＋新規話") }
            }

            // ---- 本文エディタ ----
            OutlinedTextField(
                value = state.title,
                onValueChange = vm::onTitleChange,
                label = { Text("話タイトル") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = state.body,
                onValueChange = vm::onBodyChange,
                label = { Text("本文") },
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
            )

            // 文字数・行数（state.body をそのまま集計。IME合成中の除外は対象外）。
            val stats = countStats(state.body)
            Text(
                text = "${stats.charCount}字 / ${stats.lineCount}行",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 8.dp),
            )

            // ---- お知らせ・あとがき（開閉式）----
            TextButton(onClick = { notesExpanded = !notesExpanded }) {
                Text((if (notesExpanded) "▲ " else "▼ ") + "お知らせ・あとがき")
            }
            if (notesExpanded) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 260.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedTextField(
                        value = state.foreNote,
                        onValueChange = vm::onForeNoteChange,
                        label = { Text("この話のお知らせ（前書き）") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = state.afterNote,
                        onValueChange = vm::onAfterNoteChange,
                        label = { Text("この話のあとがき（後書き）") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = state.novelForeNote,
                        onValueChange = vm::onNovelForeNoteChange,
                        label = { Text("小説共通のお知らせ") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = state.novelAfterNote,
                        onValueChange = vm::onNovelAfterNoteChange,
                        label = { Text("小説共通のあとがき") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = state.novelTitle,
                        onValueChange = vm::onNovelTitleChange,
                        label = { Text("小説タイトル") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(4.dp))
                }
            }

            // ---- テーマ切替 ----
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                ThemeOption("紙", state.theme == ThemeChoice.PAPER) { vm.setTheme(ThemeChoice.PAPER) }
                ThemeOption("セピア", state.theme == ThemeChoice.SEPIA) { vm.setTheme(ThemeChoice.SEPIA) }
                ThemeOption("夜", state.theme == ThemeChoice.NIGHT) { vm.setTheme(ThemeChoice.NIGHT) }
            }
        }
    }

    // 話削除の確認ダイアログ。
    val pending = episodeToDelete
    if (pending != null) {
        AlertDialog(
            onDismissRequest = { episodeToDelete = null },
            title = { Text("話を削除") },
            text = { Text("この話を削除しますか？この操作は元に戻せません。") },
            confirmButton = {
                TextButton(
                    onClick = {
                        vm.removeEpisode(pending)
                        episodeToDelete = null
                    },
                ) { Text("削除") }
            },
            dismissButton = {
                TextButton(onClick = { episodeToDelete = null }) { Text("キャンセル") }
            },
        )
    }
}

/** [SaveStatus] を表示用ラベルへ。IDLE は空文字（インジケータ非表示）。 */
private fun saveStatusLabel(status: SaveStatus): String = when (status) {
    SaveStatus.IDLE -> ""
    SaveStatus.DIRTY -> "未保存"
    SaveStatus.SAVING -> "保存中…"
    SaveStatus.SAVED -> "保存済み"
    SaveStatus.ERROR -> "保存失敗"
}

/**
 * 話セレクタの1チップ。本体タップで選択、末尾の「🗑」タップで削除確認。
 * 選択中は primaryContainer で強調する。
 */
@Composable
private fun EpisodeChip(
    label: String,
    selected: Boolean,
    onSelect: () -> Unit,
    onDelete: () -> Unit,
) {
    val container = if (selected) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.surfaceVariant
    }
    val content = if (selected) {
        MaterialTheme.colorScheme.onPrimaryContainer
    } else {
        MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(
        shape = RoundedCornerShape(50),
        color = container,
        contentColor = content,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .widthInChip()
                    .clickable(onClick = onSelect)
                    .padding(start = 14.dp, end = 6.dp, top = 8.dp, bottom = 8.dp),
            )
            Text(
                text = "🗑",
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier
                    .clickable(onClick = onDelete)
                    .padding(start = 2.dp, end = 10.dp, top = 8.dp, bottom = 8.dp),
            )
        }
    }
}

/** チップ内ラベルの最大幅（長いタイトルは省略表示）。 */
private fun Modifier.widthInChip(): Modifier = this.widthIn(max = 160.dp)

/** テーマ切替の1ボタン。選択中は塗り、未選択はアウトライン。 */
@Composable
private fun ThemeOption(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    if (selected) {
        Button(onClick = onClick) { Text(label) }
    } else {
        OutlinedButton(onClick = onClick) { Text(label) }
    }
}
