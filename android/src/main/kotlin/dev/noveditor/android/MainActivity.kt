package dev.noveditor.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import dev.noveditor.core.stats.countStats

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    Foundation()
                }
            }
        }
    }
}

/** Foundation smoke test: proves the shared Kotlin Multiplatform core is callable from Android. */
@Composable
private fun Foundation() {
    val stats = countStats("ノヴェディタ\nテスト")
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text = "noveditor — core OK: ${stats.charCount}字 / ${stats.lineCount}行")
    }
}
