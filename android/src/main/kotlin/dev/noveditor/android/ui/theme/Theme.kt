package dev.noveditor.android.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** 紙 / セピア / 夜 — referenced across the app (ViewModel, MainActivity). */
enum class ThemeChoice { PAPER, SEPIA, NIGHT }

// Color schemes ported from the web design tokens. Token -> Material3 slot:
//   background = paper, surface = surface, surfaceVariant = surface-sunken,
//   onBackground/onSurface = ink, onSurfaceVariant = ink-soft,
//   primary = accent, onPrimary = accent-contrast,
//   primaryContainer = accent-wash, onPrimaryContainer = ink,
//   secondary = accent-strong.

private val PaperScheme: ColorScheme = lightColorScheme(
    background = Color(0xFFF6F3EC),
    onBackground = Color(0xFF23202B),
    surface = Color(0xFFFDFBF7),
    onSurface = Color(0xFF23202B),
    surfaceVariant = Color(0xFFF1ECE2),
    onSurfaceVariant = Color(0xFF4A4654),
    primary = Color(0xFF7F52FF),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFF0EBFF),
    onPrimaryContainer = Color(0xFF23202B),
    secondary = Color(0xFF6A3DF0),
)

private val SepiaScheme: ColorScheme = lightColorScheme(
    background = Color(0xFFF3EAD8),
    onBackground = Color(0xFF3A2E20),
    surface = Color(0xFFF7F0E1),
    onSurface = Color(0xFF3A2E20),
    surfaceVariant = Color(0xFFEBDFC8),
    onSurfaceVariant = Color(0xFF5B4A37),
    primary = Color(0xFF6E44E8),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFE8DCF3),
    onPrimaryContainer = Color(0xFF3A2E20),
    secondary = Color(0xFF5A32CF),
)

private val NightScheme: ColorScheme = darkColorScheme(
    background = Color(0xFF1A1916),
    onBackground = Color(0xFFECE7DF),
    surface = Color(0xFF232220),
    onSurface = Color(0xFFECE7DF),
    surfaceVariant = Color(0xFF2C2A26),
    onSurfaceVariant = Color(0xFFC5BEB1),
    primary = Color(0xFFB29DFF),
    onPrimary = Color(0xFF1A1916),
    primaryContainer = Color(0xFF2A2542),
    onPrimaryContainer = Color(0xFFECE7DF),
    secondary = Color(0xFFC8BAFF),
)

@Composable
fun NoveditorTheme(choice: ThemeChoice, content: @Composable () -> Unit) {
    val scheme = when (choice) {
        ThemeChoice.PAPER -> PaperScheme
        ThemeChoice.SEPIA -> SepiaScheme
        ThemeChoice.NIGHT -> NightScheme
    }
    MaterialTheme(colorScheme = scheme) { content() }
}
