package com.markai.markai_mobile

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File

class MainActivity : FlutterActivity() {
    private var incomingShares: IncomingShares? = null

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        incomingShares?.accept(intent)
    }

    override fun onDestroy() {
        incomingShares?.dispose()
        incomingShares = null
        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        incomingShares = IncomingShares(this, flutterEngine.dartExecutor.binaryMessenger)
        incomingShares?.accept(intent)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "markai/updates")
            .setMethodCallHandler { call, result ->
                try {
                    when (call.method) {
                        "info" -> {
                            val info = packageManager.getPackageInfo(packageName, 0)
                            result.success(mapOf(
                                "versionName" to info.versionName,
                                "versionCode" to if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong(),
                                "packageName" to packageName,
                                "sdk" to Build.VERSION.SDK_INT,
                                "debug" to ((applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0)
                            ))
                        }
                        "canInstall" -> result.success(Build.VERSION.SDK_INT < 26 || packageManager.canRequestPackageInstalls())
                        "requestPermission" -> {
                            if (Build.VERSION.SDK_INT >= 26) {
                                startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
                            }
                            result.success(null)
                        }
                        "install" -> {
                            val path = call.argument<String>("path") ?: error("Missing APK")
                            val expected = call.argument<Number>("versionCode")?.toLong() ?: error("Missing version")
                            // Package parsing runs off the UI thread. Only this app's update cache can be shared.
                            Thread {
                                try {
                                    val apk = File(path).canonicalFile
                                    val root = File(cacheDir, "updates").canonicalFile
                                    check(apk.parentFile == root && apk.isFile && apk.extension == "apk")
                                    val incoming = packageManager.getPackageArchiveInfo(apk.path, PackageManager.GET_SIGNATURES) ?: error("Invalid APK")
                                    val installed = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
                                    val version = if (Build.VERSION.SDK_INT >= 28) incoming.longVersionCode else incoming.versionCode.toLong()
                                    val current = if (Build.VERSION.SDK_INT >= 28) installed.longVersionCode else installed.versionCode.toLong()
                                    check(incoming.packageName == packageName && version == expected && version > current)
                                    val signatures = incoming.signatures?.toSet()
                                    check(!signatures.isNullOrEmpty() && signatures == installed.signatures?.toSet())
                                    runOnUiThread {
                                        try {
                                            val uri = FileProvider.getUriForFile(this, "$packageName.updates", apk)
                                            startActivity(Intent(Intent.ACTION_VIEW).apply {
                                                setDataAndType(uri, "application/vnd.android.package-archive")
                                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                            })
                                            result.success(null)
                                        } catch (_: Exception) { result.error("INSTALL", "无法打开系统安装器，请稍后重试", null) }
                                    }
                                } catch (_: Exception) {
                                    runOnUiThread { result.error("INVALID_APK", "安装包版本或签名不匹配，请重新下载", null) }
                                }
                            }.start()
                        }
                        else -> result.notImplemented()
                    }
                } catch (_: Exception) { result.error("UPDATE", "无法执行更新操作，请稍后重试", null) }
            }
    }
}
