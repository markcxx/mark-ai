import toast from "react-hot-toast";
import type { StoreApi } from "zustand";

import { THINKING_TEXTS } from "@/lib/chat/constants";
import { createSmoothTextController, parseChatStreamLine } from "@/lib/chat/client/streaming";
import { extractThinkingFromText } from "@/lib/chat/helpers";
import {
  estimateMessageTokens,
  estimateMessagesTokens,
  estimateTextTokens,
} from "@/lib/chat/metrics";
import type { Message, MessageSegment } from "@/lib/chat/types";
import { useSettingsStore } from "@/stores/useSettingsStore";

import type { ChatStore } from "../useChatStore";

const getTotalTokens = (inputTokens: number, outputTokens: number, totalTokens?: number) =>
  totalTokens ?? inputTokens + outputTokens;

const getClientTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

export const createStreamAssistantMessage =
  (
    set: StoreApi<ChatStore>["setState"],
    get: StoreApi<ChatStore>["getState"],
  ): ChatStore["streamAssistantMessage"] =>
  async (historyMessages, modelMessageId, modelConfig, options = {}) => {
    const startedAt = Date.now();
    const settings = useSettingsStore.getState().general;
    const responseAnimation = settings.reduceMotion ? "none" : settings.responseAnimation;
    let plainContent = options.initialContent || "";
    let inputTokens = estimateMessagesTokens(historyMessages);
    let outputTokens = 0;
    let totalTokens: number | undefined;
    let tokenUsageSource: Message["tokenUsageSource"] = "estimated";
    const segments: MessageSegment[] = [];
    let currentReasoningStart: number | undefined;
    let currentThinkingSegment: Extract<MessageSegment, { type: "thinking" }> | undefined;

    const getAllReasoning = () =>
      segments
        .filter((s): s is Extract<MessageSegment, { type: "thinking" }> => s.type === "thinking")
        .map((s) => s.content)
        .join("");

    const estimateGeneratedOutputTokens = () => {
      const generatedText = plainContent.slice(options.initialContent?.length || 0);
      const extracted = extractThinkingFromText(generatedText);
      return estimateMessageTokens({
        content: extracted.content,
        reasoning: `${getAllReasoning()}${extracted.reasoning}`,
      });
    };

    const finishCurrentReasoning = () => {
      const seg = currentThinkingSegment;
      if (seg && seg.isActive) {
        seg.isActive = false;
        if (currentReasoningStart) {
          seg.duration = (seg.duration || 0) + Date.now() - currentReasoningStart;
        }
        currentReasoningStart = undefined;
      }
    };

    const controller = new AbortController();
    let contentController: ReturnType<typeof createSmoothTextController> | undefined;
    let reasoningController: ReturnType<typeof createSmoothTextController> | undefined;
    set({ abortController: controller });

    try {
      set((s) => {
        const index = THINKING_TEXTS.indexOf(s.loadingText);
        return {
          isLoading: true,
          loadingText: THINKING_TEXTS[(index + 1) % THINKING_TEXTS.length],
        };
      });

      const response = await fetch("/api/chat", {
        body: JSON.stringify({
          messages: historyMessages.map((m) => ({
            attachments: m.attachments,
            content: m.content,
            role: m.role,
          })),
          model: modelConfig.id,
          provider: modelConfig.provider,
          sessionId: options.sessionId,
          timezone: getClientTimezone(),
          webSearchEnabled: Boolean(options.webSearchEnabled),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let detail = errorText;
        try {
          const parsed = JSON.parse(errorText);
          detail = parsed?.detail || parsed?.error?.message || parsed?.error || errorText;
        } catch {
          // Use raw text fallback.
        }
        throw new Error(typeof detail === "string" && detail.trim() ? detail : "模型请求失败");
      }
      if (!response.body) throw new Error("No response body");

      const removedContextMessages = Number(response.headers.get("X-MarkAI-Context-Removed"));
      const contextContentTruncated = response.headers.get("X-MarkAI-Context-Truncated") === "1";
      if (removedContextMessages > 0 || contextContentTruncated) {
        const details = [
          removedContextMessages > 0 ? `${removedContextMessages} 条较早消息` : "",
          contextContentTruncated ? "过长的附件或消息内容" : "",
        ].filter(Boolean);
        toast(`上下文已自动裁剪：${details.join("、")}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const isStructuredStream = response.headers
        .get("content-type")
        ?.includes("application/x-ndjson");
      let done = false;
      let buffer = "";

      const isAnyThinkingActive = () => segments.some((s) => s.type === "thinking" && s.isActive);

      const updateStreamingMessage = () => {
        const extracted = extractThinkingFromText(plainContent);
        const eventReasoning = getAllReasoning();
        const reasoning = `${eventReasoning}${extracted.reasoning}`;
        const estimatedOutputTokens = estimateGeneratedOutputTokens();
        const nextOutputTokens = outputTokens || estimatedOutputTokens;
        const nextTotalTokens = getTotalTokens(inputTokens, nextOutputTokens, totalTokens);
        const anyActive = isAnyThinkingActive() || extracted.hasOpenThinking;
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === modelMessageId
              ? {
                  ...m,
                  content: extracted.content,
                  inputTokens,
                  isReasoning: anyActive,
                  outputTokens: nextOutputTokens,
                  reasoning,
                  tokenUsageSource,
                  totalTokens: nextTotalTokens,
                  segments: [...segments],
                }
              : m,
          ),
        }));
      };

      const commitContent = (chunk: string) => {
        plainContent += chunk;
        finishCurrentReasoning();
        const extracted = extractThinkingFromText(plainContent);
        const cleanContent = extracted.content;
        if (cleanContent) {
          const prevContentLength = segments
            .filter((s): s is Extract<MessageSegment, { type: "content" }> => s.type === "content")
            .reduce((sum, s) => sum + s.content.length, 0);
          const newPart = cleanContent.slice(prevContentLength);
          if (newPart) {
            const lastSeg = segments[segments.length - 1];
            if (lastSeg && lastSeg.type === "content") {
              lastSeg.content = lastSeg.content + newPart;
            } else {
              segments.push({ type: "content", content: newPart });
            }
          }
        }
        updateStreamingMessage();
      };

      const commitReasoning = (chunk: string) => {
        if (!currentThinkingSegment) {
          currentThinkingSegment = { type: "thinking", content: "", isActive: true };
          segments.push(currentThinkingSegment);
          currentReasoningStart = Date.now();
        } else if (!currentThinkingSegment.isActive) {
          currentThinkingSegment.isActive = true;
          currentReasoningStart = Date.now();
        }
        currentThinkingSegment.content += chunk;
        updateStreamingMessage();
      };

      if (responseAnimation === "smooth") {
        contentController = createSmoothTextController(commitContent);
        reasoningController = createSmoothTextController(commitReasoning);
      }

      const appendContent = (chunk: string) => {
        reasoningController?.flush();
        if (contentController) {
          contentController.push(chunk);
          return;
        }
        commitContent(chunk);
      };

      const appendReasoning = (chunk: string) => {
        contentController?.flush();
        if (reasoningController) {
          reasoningController.push(chunk);
          return;
        }
        commitReasoning(chunk);
      };

      const handleStreamLine = (line: string) => {
        const event = parseChatStreamLine(line);
        if (!event) return;
        if (event.type === "usage") {
          inputTokens = event.inputTokens ?? inputTokens;
          outputTokens = event.outputTokens ?? outputTokens;
          totalTokens = getTotalTokens(inputTokens, outputTokens, event.totalTokens);
          tokenUsageSource = event.tokenUsageSource ?? "estimated";
          updateStreamingMessage();
          return;
        }
        if (event.type === "tool" && event.webSearch) {
          contentController?.flush();
          reasoningController?.flush();
          finishCurrentReasoning();
          currentThinkingSegment = undefined;
          const ws = event.webSearch;
          const existingIdx = segments.findIndex(
            (s) =>
              s.type === "tool" && s.webSearch.tool === ws.tool && s.webSearch.query === ws.query,
          );
          if (existingIdx >= 0) {
            (segments[existingIdx] as Extract<MessageSegment, { type: "tool" }>).webSearch = ws;
          } else {
            segments.push({ type: "tool", webSearch: ws });
          }
          updateStreamingMessage();
          return;
        }
        if (event.type === "file" && event.generatedFile) {
          contentController?.flush();
          reasoningController?.flush();
          finishCurrentReasoning();
          currentThinkingSegment = undefined;
          const generatedFile = event.generatedFile;
          const existingIdx = segments.findIndex(
            (segment) =>
              segment.type === "generated-file" &&
              segment.generatedFile.callId === generatedFile.callId,
          );
          if (existingIdx >= 0) {
            segments[existingIdx] = { generatedFile, type: "generated-file" };
          } else {
            segments.push({ generatedFile, type: "generated-file" });
          }
          updateStreamingMessage();
          return;
        }
        if (event.type === "reasoning" && event.text) {
          appendReasoning(event.text);
          return;
        }
        if (event.type === "content" && event.text) appendContent(event.text);
      };

      while (!done) {
        const { done: doneReading, value } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          if (!isStructuredStream) {
            appendContent(chunk);
            continue;
          }
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) handleStreamLine(line);
        }
      }

      if (isStructuredStream && buffer) handleStreamLine(buffer);
      await reasoningController?.finish();
      await contentController?.finish();
      finishCurrentReasoning();

      const extracted = extractThinkingFromText(plainContent);
      const finalEventReasoning = getAllReasoning();
      const reasoning = `${finalEventReasoning}${extracted.reasoning}` || undefined;
      const allWebSearch = segments
        .filter((s): s is Extract<MessageSegment, { type: "tool" }> => s.type === "tool")
        .map((s) => s.webSearch);
      const reasoningDuration =
        segments
          .filter((s): s is Extract<MessageSegment, { type: "thinking" }> => s.type === "thinking")
          .reduce((sum, s) => sum + (s.duration || 0), 0) || undefined;
      const estimatedOutputTokens = estimateGeneratedOutputTokens();
      const finalOutputTokens = outputTokens || estimatedOutputTokens;
      const finalTotalTokens = getTotalTokens(inputTokens, finalOutputTokens, totalTokens);
      return {
        content: extracted.content,
        generationDuration: Date.now() - startedAt,
        inputTokens,
        isReasoning: false,
        isStreaming: false,
        outputTokens: finalOutputTokens,
        reasoning,
        reasoningDuration,
        segments: segments.length > 0 ? [...segments] : undefined,
        tokenUsageSource,
        totalTokens: finalTotalTokens,
        webSearch: allWebSearch.length > 0 ? allWebSearch : undefined,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        contentController?.flush();
        reasoningController?.flush();
        finishCurrentReasoning();
        const extracted = extractThinkingFromText(plainContent);
        const abortReasoning = getAllReasoning();
        const reasoning = `${abortReasoning}${extracted.reasoning}` || undefined;
        const allWebSearch = segments
          .filter((s): s is Extract<MessageSegment, { type: "tool" }> => s.type === "tool")
          .map((s) => s.webSearch);
        const reasoningDuration =
          segments
            .filter(
              (s): s is Extract<MessageSegment, { type: "thinking" }> => s.type === "thinking",
            )
            .reduce((sum, s) => sum + (s.duration || 0), 0) || undefined;
        const estimatedOutputTokens = estimateGeneratedOutputTokens();
        const finalOutputTokens = outputTokens || estimatedOutputTokens;
        const finalTotalTokens = getTotalTokens(inputTokens, finalOutputTokens, totalTokens);
        return {
          content: extracted.content || plainContent,
          generationDuration: Date.now() - startedAt,
          inputTokens,
          interrupted: true,
          isReasoning: false,
          isStreaming: false,
          outputTokens: finalOutputTokens,
          reasoning,
          reasoningDuration,
          segments: segments.length > 0 ? [...segments] : undefined,
          tokenUsageSource,
          totalTokens: finalTotalTokens,
          webSearch: allWebSearch.length > 0 ? allWebSearch : undefined,
        };
      }
      contentController?.flush();
      reasoningController?.flush();
      console.error("Chat error:", error);
      const failureMessage = "生成失败，请稍后重试。";
      toast.error(failureMessage);
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === modelMessageId
            ? {
                ...m,
                content: failureMessage,
                interrupted: true,
                isReasoning: false,
              }
            : m,
        ),
      }));
      const errReasoning = getAllReasoning();
      return {
        content: failureMessage,
        generationDuration: Date.now() - startedAt,
        inputTokens,
        isReasoning: false,
        interrupted: true,
        isStreaming: false,
        outputTokens: estimateTextTokens(failureMessage),
        reasoning: errReasoning || undefined,
        segments: segments.length > 0 ? [...segments] : undefined,
        tokenUsageSource: "estimated",
        totalTokens:
          inputTokens + estimateTextTokens(failureMessage),
      };
    } finally {
      set((s) => ({
        ...(s.abortController === controller ? { isLoading: false, abortController: null } : {}),
        messages: s.messages.map((m) =>
          m.id === modelMessageId ? { ...m, isReasoning: false, isStreaming: false } : m,
        ),
      }));
    }
  };
