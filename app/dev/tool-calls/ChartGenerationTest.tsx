"use client";

import { Loader2, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ModelSelectorDialog } from "@/components/chat/ModelSelectorDialog";
import { AppTextArea } from "@/components/ui/AppInput";
import { getModelKey } from "@/lib/chat/helpers";
import { isImageGenerationModel } from "@/lib/chat/image-models";
import type { ConfiguredModel, Message } from "@/lib/chat/types";
import type { ChartTestAttempt } from "@/lib/chat/server/chart-test";
import {
  applyChartPreviewEvent,
  finishChartPreviewMessage,
  type ChartPreviewEvent,
} from "@/lib/chat/chart-test-stream";
import { useUIStore } from "@/stores/useUIStore";

export type GeneratedTestChart = { message: Message; prompt: string; model: string };

export function ChartGenerationTest({ onChart }: { onChart: (chart: GeneratedTestChart) => void }) {
  const [models, setModels] = useState<ConfiguredModel[]>([]);
  const [providerNames, setProviderNames] = useState<Record<string, string>>({});
  const [modelKey, setModelKey] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [search, setSearch] = useState("");
  const [prompt, setPrompt] = useState(
    "随机选择一种合适的常用二维 ECharts 图表，展示五月至九月的资料整理数量：18、26、33、47、62 篇。使用中文标题，保留这些数据，不要添加其他数值。",
  );
  const [attempts, setAttempts] = useState<ChartTestAttempt[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [running, setRunning] = useState(false);
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState("");
  const [actualRoute, setActualRoute] = useState<{
    provider: string;
    model: string;
    endpoint: string;
  } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const model = models.find((item) => getModelKey(item) === modelKey);

  const loadModels = async (signal?: AbortSignal) => {
    setLoadingModels(true);
    try {
      const response = await fetch("/api/models", { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "无法加载模型列表，请先登录后重试");
      const available: ConfiguredModel[] = (data.models || []).filter(
        (item: ConfiguredModel) => !isImageGenerationModel(item.id),
      );
      setModels(available);
      setProviderNames(data.providerNames || {});
      const preferred = useUIStore.getState().selectedModelKey;
      setModelKey((current) =>
        available.some((item) => getModelKey(item) === current)
          ? current
          : available.some((item) => getModelKey(item) === preferred)
            ? preferred
            : available[0]
              ? getModelKey(available[0])
              : "",
      );
      setError(available.length ? "" : "暂无可用文字模型，请先配置模型");
    } catch (reason) {
      if (!signal?.aborted) setError(reason instanceof Error ? reason.message : "模型列表加载失败");
    } finally {
      if (!signal?.aborted) setLoadingModels(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadModels(controller.signal);
    return () => {
      controller.abort();
      requestRef.current?.abort();
    };
  }, []);

  const run = async () => {
    if (!model || running) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setRunning(true);
    setAttempts([]);
    setError("");
    setOutcome("");
    setActualRoute(null);
    let validated = false;
    let streamedMessage: Message = {
      id: `chart-test-${Date.now()}`,
      role: "model",
      model: model.id,
      provider: model.provider,
      content: "",
      reasoning: "",
      segments: [],
      isStreaming: true,
    };
    const publish = () => onChart({ message: streamedMessage, prompt, model: model.id });
    publish();
    try {
      const response = await fetch("/api/dev/chart-test", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model.id,
          provider: model.provider,
          prompt,
          thinkingEnabled,
        }),
      });
      const route = response.headers.get("X-MarkAI-Test-Route");
      if (route) {
        try {
          setActualRoute(JSON.parse(decodeURIComponent(route)));
        } catch {
          /* Diagnostics do not affect the generation stream. */
        }
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `测试请求失败（${response.status}）`);
      }
      if (!response.body) throw new Error("测试服务没有返回数据");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const accept = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === "attempt") {
          setAttempts((current) => [...current, event]);
          if (!event.error) validated = true;
          return;
        }
        if (["reasoning", "content", "file", "usage", "error"].includes(event.type)) {
          streamedMessage = applyChartPreviewEvent(streamedMessage, event as ChartPreviewEvent);
          publish();
        }
        if (event.type === "error") throw new Error(event.text);
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          lines.forEach(accept);
          if (done) {
            accept(buffer);
            break;
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      if (
        !streamedMessage.content &&
        !streamedMessage.reasoning &&
        !streamedMessage.segments?.length
      )
        throw new Error("模型未返回任何输出");
      setOutcome(
        validated
          ? "模型输出完成，图表校验记录可展开查看。"
          : "模型输出完成，本次未提交通过工具校验的图表。",
      );
    } catch (reason) {
      const message = controller.signal.aborted
        ? "测试已停止"
        : reason instanceof Error
          ? reason.message
          : String(reason);
      setError(message);
      if (!streamedMessage.interrupted)
        streamedMessage = applyChartPreviewEvent(streamedMessage, { type: "error", text: message });
    } finally {
      streamedMessage = finishChartPreviewMessage(streamedMessage);
      publish();
      requestRef.current = null;
      setRunning(false);
    }
  };

  return (
    <section className="space-y-3 border-b border-gray-100 pb-5 dark:border-white/[0.08]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">真实模型测试</h2>
        <span className="text-xs text-gray-400">实时流式输出 · 校验失败最多修正 2 次</span>
      </div>
      <AppTextArea
        aria-label="图表测试要求"
        disabled={running}
        onChange={(event) => setPrompt(event.target.value)}
        rows={3}
        value={prompt}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          className="min-h-10 min-w-0 flex-1 truncate rounded-lg border border-gray-200 px-3 text-left text-xs disabled:opacity-50 dark:border-white/10"
          disabled={loadingModels || !models.length || running}
          onClick={() => setSelecting(true)}
          type="button"
        >
          {loadingModels
            ? "正在加载模型…"
            : model
              ? `${providerNames[model.provider] || model.provider} / ${model.id}`
              : "选择输出模型"}
        </button>
        <button
          className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs text-white disabled:opacity-40 dark:text-gray-950"
          disabled={!model || !prompt.trim() || running || loadingModels}
          onClick={() => void run()}
          type="button"
        >
          {running ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
          {running ? "正在生成…" : "生成并测试"}
        </button>
        {model?.thinking && (
          <label className="flex min-h-10 items-center gap-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={thinkingEnabled}
              disabled={running}
              onChange={(event) => setThinkingEnabled(event.target.checked)}
            />
            深度思考
          </label>
        )}
        {running && (
          <button
            className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
            onClick={() => requestRef.current?.abort()}
            type="button"
          >
            <Square size={13} />
            停止
          </button>
        )}
        {!running && (
          <button
            className="min-h-10 px-2 text-xs underline"
            onClick={() => void loadModels()}
            disabled={loadingModels}
            type="button"
          >
            刷新模型列表
          </button>
        )}
      </div>
      {actualRoute && (
        <p className="break-words text-xs text-gray-500">
          本次实际渠道：{actualRoute.provider} · {actualRoute.model}
          <br />
          {actualRoute.endpoint}
        </p>
      )}
      {error && (
        <p
          className="whitespace-pre-wrap break-words text-xs text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}
      {outcome && (
        <p className="text-xs text-gray-500" role="status">
          {outcome}
        </p>
      )}
      {attempts.map((attempt) => (
        <details className="text-xs text-gray-500 dark:text-gray-400" key={attempt.index}>
          <summary className="cursor-pointer py-1.5">
            第 {attempt.index} 轮原始输出 ·{" "}
            {attempt.error
              ? "未通过校验"
              : attempt.validation === "render"
                ? "结构与渲染通过"
                : "仅结构通过"}
          </summary>
          {attempt.error && <p className="py-2 text-red-600 dark:text-red-400">{attempt.error}</p>}
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-50 p-3 font-mono text-[11px] dark:bg-white/[0.03]">
            {attempt.raw || "（模型未返回内容）"}
          </pre>
        </details>
      ))}
      <ModelSelectorDialog
        availableModels={models}
        modelSearchKeyword={search}
        onClose={() => setSelecting(false)}
        open={selecting}
        providerNames={providerNames}
        selectedModelKey={modelKey}
        setModelSearchKeyword={setSearch}
        setSelectedModelKey={setModelKey}
      />
    </section>
  );
}
