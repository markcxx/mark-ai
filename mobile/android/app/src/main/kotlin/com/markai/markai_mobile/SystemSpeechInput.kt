package com.markai.markai_mobile

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import java.util.Locale

/** Uses the user's configured system recognizer; MarkAI never uploads audio. */
class SystemSpeechInput(private val activity: Activity, messenger: BinaryMessenger) {
    private var recognizer: SpeechRecognizer? = null
    private var sink: EventChannel.EventSink? = null
    private var session: String? = null
    private val methods = MethodChannel(messenger, "markai/speech_input")
    private val events = EventChannel(messenger, "markai/speech_input/events")

    init {
        events.setStreamHandler(object : EventChannel.StreamHandler {
            override fun onListen(arguments: Any?, eventSink: EventChannel.EventSink) { sink = eventSink }
            override fun onCancel(arguments: Any?) { cancel(); sink = null }
        })
        methods.setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "available" -> result.success(SpeechRecognizer.isRecognitionAvailable(activity))
                    "start" -> {
                        val id = call.argument<String>("session")
                        if (id == null || sink == null) {
                            result.error("not_ready", "语音输入尚未准备好，请重试", null)
                        } else if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
                            result.error("unavailable", "此设备未安装可用的系统语音识别服务，请在系统设置中启用语音输入服务", null)
                        } else if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                            activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 7319)
                            // Never start the microphone after a permission dialog has interrupted the hold.
                            result.error("permission", "请允许麦克风权限后再次长按；若无法授权，请前往系统设置开启权限", null)
                        } else {
                            start(id)
                            result.success(null)
                        }
                    }
                    "stop" -> {
                        if (session == call.argument<String>("session")) recognizer?.stopListening()
                        result.success(null)
                    }
                    "cancel" -> {
                        if (session == call.argument<String>("session")) cancel()
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            } catch (_: Exception) {
                cancel()
                result.error("speech_failed", "系统语音识别启动失败，请检查语音服务后重试", null)
            }
        }
    }

    private fun emit(id: String, type: String, value: Any? = null) {
        if (session == id) sink?.success(mapOf("session" to id, "type" to type, "value" to value))
    }

    private fun start(id: String) {
        cancel()
        session = id
        val current = SpeechRecognizer.createSpeechRecognizer(activity)
        recognizer = current
        current.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) { emit(id, "ready") }
            override fun onBeginningOfSpeech() { emit(id, "ready") }
            override fun onRmsChanged(rmsdB: Float) { emit(id, "level", rmsdB.toDouble()) }
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() { emit(id, "end") }
            override fun onPartialResults(results: Bundle?) {
                emit(id, "partial", results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: "")
            }
            override fun onResults(results: Bundle?) {
                emit(id, "final", results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: "")
                finish(id)
            }
            override fun onError(error: Int) {
                val message = when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "没有听清，请再次长按说话"
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "麦克风权限未开启，请在系统设置中允许录音"
                    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "系统识别服务连接失败，请检查网络后重试"
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "系统语音识别正在使用中，请稍后重试"
                    SpeechRecognizer.ERROR_AUDIO -> "无法使用麦克风，请检查是否被其他应用占用"
                    12, 13 -> "系统识别服务不支持当前语言，请在系统设置中安装或切换语音语言"
                    else -> "系统语音识别失败，请稍后重试"
                }
                emit(id, "error", message)
                finish(id)
            }
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        current.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        })
    }

    private fun finish(id: String) {
        if (session != id) return
        session = null
        val old = recognizer
        recognizer = null
        activity.window.decorView.post { old?.destroy() }
    }

    fun cancel() {
        session = null // Ignore late callbacks before stopping the service.
        val old = recognizer
        recognizer = null
        old?.cancel()
        old?.destroy()
    }

    fun dispose() {
        cancel()
        methods.setMethodCallHandler(null)
        events.setStreamHandler(null)
        sink = null
    }
}
