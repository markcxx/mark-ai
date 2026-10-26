"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { ModelSelectorDialog } from "@/components/chat/ModelSelectorDialog";
import { AppTextArea } from "@/components/ui/AppInput";
import { getModelKey } from "@/lib/chat/helpers";
import { isImageGenerationModel } from "@/lib/chat/image-models";
import {
  applyChartPreviewEvent,
  finishChartPreviewMessage,
  type ChartPreviewEvent,
} from "@/lib/chat/chart-test-stream";
import type { ConfiguredModel, Message } from "@/lib/chat/types";
import { useUIStore } from "@/stores/useUIStore";

export type WebTestResult = { message: Message; prompt: string; model: string };
export function WebResearchTest({ onResult }: { onResult: (result: WebTestResult) => void }) {
  const [models, setModels] = useState<ConfiguredModel[]>([]);
  const [providerNames, setProviderNames] = useState<Record<string, string>>({});
  const [modelKey, setModelKey] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [search, setSearch] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState("");
  const [prompt, setPrompt] = useState(
    "请阅读 https://www.dpm.org.cn/explore/building/236465.html ，核实太和殿走兽的数量，给出原文依据，展示该页面里的两张实景配图并附来源。",
  );
  const requestRef = useRef<AbortController | null>(null);
  const model = models.find((item) => getModelKey(item) === modelKey);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/models", { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "请先登录，再刷新页面加载可用模型");
        const available = (data.models || []).filter(
          (item: ConfiguredModel) => !isImageGenerationModel(item.id),
        );
        setModels(available);
        setProviderNames(data.providerNames || {});
        const preferred = useUIStore.getState().selectedModelKey;
        setModelKey(
          available.some((item: ConfiguredModel) => getModelKey(item) === preferred)
            ? preferred
            : available[0]
              ? getModelKey(available[0])
              : "",
        );
        if (!available.length) setError("暂无可用文字模型，请先配置模型");
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "模型列表加载失败，请刷新后重试");
      }
    })();
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
    setError("");
    setOutcome("");
    let message: Message = {
      id: `web-test-${Date.now()}`,
      role: "model",
      model: model.id,
      provider: model.provider,
      content: "",
      segments: [],
      isStreaming: true,
    };
    const publish = () => onResult({ message, prompt, model: model.id });
    publish();
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          model: model.id,
          provider: model.provider,
          webSearchEnabled: true,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `测试请求失败（${response.status}），请稍后重试`);
      }
      if (!response.body) throw new Error("模型未返回数据，请重试");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const accept = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (["content", "reasoning", "tool", "usage", "error"].includes(event.type)) {
          message = applyChartPreviewEvent(message, event as ChartPreviewEvent);
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
      if (!message.content && !message.segments?.length)
        throw new Error("模型没有返回内容，请更换模型重试");
      const calls = message.segments?.filter((segment) => segment.type === "tool") || [];
      setOutcome(
        `已完成 ${calls.length} 次联网工具调用。可展开下方记录核对正文、定位结果和图片来源。本次测试不保存到会话历史。`,
      );
    } catch (reason) {
      const text = controller.signal.aborted
        ? "测试已停止"
        : reason instanceof Error
          ? reason.message
          : "测试失败，请重试";
      setError(text);
      if (!message.interrupted) message = applyChartPreviewEvent(message, { type: "error", text });
    } finally {
      message = finishChartPreviewMessage(message);
      publish();
      setRunning(false);
      requestRef.current = null;
    }
  };
  return (
    <section className="space-y-3 border-b border-gray-100 py-3 dark:border-white/10">
      <AppTextArea
        aria-label="联网测试要求"
        rows={3}
        value={prompt}
        disabled={running}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!models.length || running}
          onClick={() => setSelecting(true)}
          className="min-h-10 min-w-0 flex-1 truncate rounded-lg border border-gray-200 px-3 text-left text-xs disabled:opacity-50 dark:border-white/10"
        >
          {model
            ? `${providerNames[model.provider] || model.provider} / ${model.id}`
            : "等待可用模型"}
        </button>
        <button
          type="button"
          disabled={!model || !prompt.trim() || running}
          onClick={() => void run()}
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs text-white disabled:opacity-40 dark:text-gray-950"
        >
          <Play size={14} />
          {running ? "正在检索…" : "联网测试"}
        </button>
        {running && (
          <button
            type="button"
            onClick={() => requestRef.current?.abort()}
            className="flex min-h-10 items-center gap-1.5 px-3 text-xs"
          >
            <Square size={14} />
            停止
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="break-words text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {outcome && (
        <p role="status" className="text-xs text-gray-500">
          {outcome}
        </p>
      )}
      <ModelSelectorDialog
        availableModels={models}
        providerNames={providerNames}
        selectedModelKey={modelKey}
        setSelectedModelKey={setModelKey}
        modelSearchKeyword={search}
        setModelSearchKeyword={setSearch}
        open={selecting}
        onClose={() => setSelecting(false)}
      />
    </section>
  );
}
