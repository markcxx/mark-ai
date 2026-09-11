package com.markai.markai_mobile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

/** Copies granted share URIs locally. Nothing is uploaded until Flutter confirms. */
class IncomingShares(private val activity: Activity, messenger: BinaryMessenger) {
    private val channel = MethodChannel(messenger, "markai/incoming_shares")
    private val worker = Executors.newSingleThreadExecutor()
    private val root = File(activity.cacheDir, "incoming-shares")
    private var disposed = false

    init {
        channel.setMethodCallHandler { call, result ->
            worker.execute {
                try {
                    val value: Any? = when (call.method) {
                        "list" -> {
                            prune()
                            root.listFiles().orEmpty().sortedBy { it.lastModified() }.mapNotNull { dir ->
                                runCatching {
                                    val json = JSONObject(File(dir, "share.json").readText())
                                    val files = json.optJSONArray("files") ?: JSONArray()
                                    mapOf("id" to dir.name, "text" to json.optString("text"), "error" to json.optString("error"),
                                        "files" to (0 until files.length()).map { index ->
                                            val file = files.getJSONObject(index)
                                            mapOf("name" to file.getString("name"), "path" to File(dir, file.getString("file")).path)
                                        })
                                }.getOrNull()
                            }
                        }
                        "remove" -> {
                            val id = call.argument<String>("id") ?: error("missing id")
                            require(runCatching { UUID.fromString(id).toString() == id }.getOrDefault(false))
                            File(root, id).deleteRecursively()
                            null
                        }
                        else -> { activity.runOnUiThread { result.notImplemented() }; return@execute }
                    }
                    activity.runOnUiThread { if (!disposed) result.success(value) }
                } catch (_: Exception) {
                    activity.runOnUiThread { if (!disposed) result.error("SHARE", "无法读取分享内容，请重新分享", null) }
                }
            }
        }
    }

    @Suppress("DEPRECATION")
    fun accept(source: Intent?) {
        if (source?.action != Intent.ACTION_SEND && source?.action != Intent.ACTION_SEND_MULTIPLE) return
        val intent = Intent(source)
        // Consume the Activity's launch intent once, including configuration recreation.
        source?.action = Intent.ACTION_MAIN
        worker.execute {
            root.mkdirs()
            prune()
            val full = root.listFiles().orEmpty().size >= 5
            val dir = File(root, if (full) "00000000-0000-0000-0000-000000000000" else UUID.randomUUID().toString()).apply { mkdirs() }
            val json = JSONObject()
            try {
                check(!full) { "待处理分享过多，请先处理已有内容" }
                val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString().orEmpty()
                check(text.length <= 100_000) { "分享文字过长，请分段分享" }
                json.put("text", text)
                val uris = mutableListOf<Uri>()
                if (intent.action == Intent.ACTION_SEND_MULTIPLE) {
                    uris.addAll(intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM).orEmpty())
                } else {
                    intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let { uris.add(it) }
                }
                if (uris.isEmpty()) {
                    val clip = intent.clipData
                    if (clip != null) for (i in 0 until clip.itemCount) clip.getItemAt(i).uri?.let { uris.add(it) }
                }
                val unique = uris.distinct()
                check(unique.size <= 4) { "一次最多分享 4 个附件" }
                check(text.isNotBlank() || unique.isNotEmpty()) { "没有收到可用的文字或文件，请重新分享" }
                var total = 0L
                val files = JSONArray()
                unique.forEachIndexed { index, uri ->
                    check(uri.scheme == "content") { "无法读取此文件来源，请从相册或文件管理器重新分享" }
                    val resolver = activity.contentResolver
                    var name: String? = null
                    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                        if (cursor.moveToFirst()) name = cursor.getString(0)
                    }
                    val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(resolver.getType(uri))
                    val safeName = (name ?: "分享文件${extension?.let { ".$it" } ?: ""}")
                        .replace(Regex("[\\\\/\\p{Cntrl}]"), "_").take(160).ifBlank { "分享文件" }
                    val output = File(dir, "$index-$safeName")
                    resolver.openInputStream(uri)?.use { input ->
                        output.outputStream().use { stream ->
                            val buffer = ByteArray(64 * 1024)
                            var size = 0L
                            while (true) {
                                val read = input.read(buffer)
                                if (read < 0) break
                                size += read; total += read
                                check(size <= 25L * 1024 * 1024 && total <= 50L * 1024 * 1024) { "单个分享文件不能超过 25MB，合计不能超过 50MB" }
                                stream.write(buffer, 0, read)
                            }
                        }
                    } ?: error("无法打开分享文件，请重新选择")
                    files.put(JSONObject().put("name", safeName).put("file", output.name))
                }
                json.put("files", files)
            } catch (error: Exception) {
                dir.listFiles().orEmpty().forEach { it.delete() }
                val reason = if (error is IllegalStateException) error.message else null
                json.put("error", reason ?: "无法读取分享附件，请回到来源应用重新分享")
                json.put("text", "").put("files", JSONArray())
            }
            File(dir, "share.json").writeText(json.toString())
            activity.runOnUiThread { if (!disposed) channel.invokeMethod("changed", null) }
        }
    }

    private fun prune() {
        root.listFiles().orEmpty().filter { System.currentTimeMillis() - it.lastModified() > 24 * 60 * 60 * 1000L }
            .forEach { it.deleteRecursively() }
    }

    fun dispose() {
        disposed = true
        channel.setMethodCallHandler(null)
        worker.shutdown()
    }
}
