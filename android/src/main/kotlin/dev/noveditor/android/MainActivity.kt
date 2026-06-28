package dev.noveditor.android

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Surface
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import dev.noveditor.android.data.AndroidNovelRepository
import dev.noveditor.android.ui.EditorScreen
import dev.noveditor.android.ui.NovelListScreen
import dev.noveditor.android.ui.theme.NoveditorTheme
import kotlinx.coroutines.launch

/**
 * Single-activity host: builds the [AppViewModel] over a file-backed repository + SharedPreferences,
 * applies the selected theme, and hosts the 作品 list in a navigation drawer beside the editor.
 */
class MainActivity : ComponentActivity() {

    private val viewModel: AppViewModel by viewModels {
        AppViewModel.factory(
            AndroidNovelRepository(filesDir),
            getSharedPreferences("noveditor", Context.MODE_PRIVATE),
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val state by viewModel.uiState.collectAsState()
            NoveditorTheme(choice = state.theme) {
                val drawerState = rememberDrawerState(DrawerValue.Closed)
                val scope = rememberCoroutineScope()
                ModalNavigationDrawer(
                    drawerState = drawerState,
                    drawerContent = {
                        ModalDrawerSheet {
                            NovelListScreen(
                                vm = viewModel,
                                onNovelOpened = { scope.launch { drawerState.close() } },
                                modifier = Modifier.fillMaxHeight(),
                            )
                        }
                    },
                ) {
                    Surface(modifier = Modifier.fillMaxSize()) {
                        EditorScreen(
                            vm = viewModel,
                            onOpenNovelList = { scope.launch { drawerState.open() } },
                        )
                    }
                }
            }
        }
    }
}
