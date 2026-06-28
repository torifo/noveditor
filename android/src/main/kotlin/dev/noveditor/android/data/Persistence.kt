package dev.noveditor.android.data

import java.io.File
import kotlinx.serialization.json.Json

/**
 * Shared JSON codec + file helpers for [AndroidNovelRepository].
 *
 * Core models are serialized with their generated serializers (`Novel.serializer()` etc.); the
 * `:android` module does not apply the serialization compiler plugin, so this file only uses the
 * runtime [Json] API. Unknown keys are ignored so a record written by a newer schema still loads.
 */
internal val json = Json {
    ignoreUnknownKeys = true
    prettyPrint = false
}

/**
 * (Re)writes [file] via a tmp-then-rename so a reader never observes a half-written file: serialize
 * to a sibling `<name>.tmp`, then rename over the target (an atomic replace on POSIX filesystems).
 */
internal fun atomicWrite(file: File, text: String) {
    file.parentFile?.mkdirs()
    val tmp = File(file.parentFile, "${file.name}.tmp")
    tmp.writeText(text)
    if (!tmp.renameTo(file)) {
        // Some filesystems refuse to rename onto an existing target; replace then retry.
        file.delete()
        tmp.renameTo(file)
    }
}

/** Reads [file] as UTF-8 text, or `null` when it does not exist. */
internal fun readTextOrNull(file: File): String? = if (file.exists()) file.readText() else null
