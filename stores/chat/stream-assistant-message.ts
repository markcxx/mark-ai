import { createFirstResponseTiming } from "@/lib/chat/client/first-response-timing";
import { stageSessionMessages } from "@/lib/chat/client/pending-session";
import { ExecutionStreamState, finishPendingExecutionTools } from "@/lib/chat/client/execution";
import { GenerationError } from "@/lib/chat/generation-error";
import { resolveThinkingEnabled } from "@/lib/model-thinking";
import toast from "react-hot-toast";
import type { StoreApi } from "zustand";

import { getNextThinkingText } from "@/lib/chat/constants";
import { createSmoothTextController, parseChatStreamLine } from "@/lib/chat/client/streaming";
import { extractThinkingFromText, getMessageContentForModel } from "@/lib/chat/helpers";
import { isImageGenerationModel } from "@/lib/chat/image-models";
import { prepareRequestHistory } from "@/lib/chat/request-history";
import { getWebResourceContext } from "@/lib/chat/web-context";
import {
  estimateMessageTokens,
  estimateMessagesTokens,
  estimateTextTokens,
} from "@/lib/chat/metrics";
import type { Message, MessageSegment } from "@/lib/chat/types";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useSessionStore } from "@/stores/useSessionStore";

import type { ChatStore } from "../useChatStore";

const sessionStreamControllers = new Map<string, AbortController>();

export const getSessionStreamController = (sessionId: string | null) =>
  sessionId ? sessionStreamControllers.get(sessionId) || null : null;

export const abortSessionStream = (sessionId: string) => {
  sessionStreamControllers.get(sessionId)?.abort();
};

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
    const firstResponseTiming = createFirstResponseTiming(options.sendStartedAt);
    const startedAt = Date.now();
    const settings = useSettingsStore.getState().general;
    const responseAnimation = settings.reduceMotion ? "none" : settings.responseAnimation;
    const mappedHistory = historyMessages.map((m) => ({
      webContext: getWebResourceContext(m),
      attachments: m.attachments,
      reasoning: m.reasoning,
      content: getMessageContentForModel(m),
      generatedImageIds: m.segments
        ?.filter((segment) => segment.type === "generated-image")
        .map((segment) => segment.generatedImage.file.id),
      role: m.role,
    }));
    // Image editing also uses empty image-only assistant turns to locate generated files.
    const requestHistory = isImageGenerationModel(modelConfig.id)
      ? mappedHistory
      : prepareRequestHistory(mappedHistory);
    let plainContent = options.initialContent || "";
    let inputTokens = estimateMessagesTokens(requestHistory);
    let outputTokens = 0;
    let totalTokens: number | undefined;
    let tokenUsageSource: Message["tokenUsageSource"] = "estimated";
    const segments: MessageSegment[] = structuredClone(options.initialSegments || []);
    const initialSegmentText = segments
      .filter((segment) => segment.type === "content")
      .map((segment) => segment.content)
      .join("");
    if (plainContent.startsWith(initialSegmentText)) {
      const remainder = plainContent.slice(initialSegmentText.length);
      if (remainder) segments.push({ type: "content", content: remainder });
    } else if (plainContent) {
      // Legacy messages may not have segments matching their edited body.
      segments.splice(0, segments.length, { type: "content", content: plainContent });
    }
    const execution = new ExecutionStreamState();
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

    const getResolvedOutputTokens = (estimatedOutputTokens: number) =>
      tokenUsageSource === "provider" ? outputTokens : outputTokens || estimatedOutputTokens;

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
    const sessionId = options.sessionId;
    let outcome: "aborted" | "completed" | "failed" = "completed";
    if (sessionId) {
      sessionStreamControllers.set(sessionId, controller);
      useSessionStore.getState().setSessionGenerationStatus(sessionId, "generating");
    }
    let contentController: ReturnType<typeof createSmoothTextController> | undefined;
    let reasoningController: ReturnType<typeof createSmoothTextController> | undefined;
    set({ abortController: controller });
    const preserveOnPageHide = () => {
      if (!sessionId || useSessionStore.getState().activeSessionId !== sessionId) return;
      contentController?.flush();
      reasoningController?.flush();
      stageSessionMessages(
        sessionId,
        get().messages,
        useSessionStore.getState().sessions?.find((session) => session.id === sessionId)?.revision,
      );
    };
    if (typeof window !== "undefined") window.addEventListener("pagehide", preserveOnPageHide);

    try {
      set((s) => {
        return {
          isLoading: true,
          loadingText: getNextThinkingText(s.loadingText),
        };
      });

      firstResponseTiming.request();
      const response = await fetch("/api/chat", {
        body: JSON.stringify({
          messages: requestHistory,
          languageModel: useSettingsStore.getState().languageModel,
          model: modelConfig.id,
          provider: modelConfig.provider,
          sessionId: options.sessionId,
          timezone: getClientTimezone(),
          webSearchEnabled: Boolean(options.webSearchEnabled),
          thinkingEnabled:
            settings.thinkingMode === "auto"
              ? undefined
              : resolveThinkingEnabled(modelConfig.thinking, settings.thinkingMode),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });

      firstResponseTiming.headers(response);
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let detail = errorText;
        try {
          const parsed = JSON.parse(errorText);
          detail = parsed?.detail || parsed?.error?.message || parsed?.error || errorText;
        } catch {
          // Use raw text fallback.
        }
        throw new GenerationError(
          typeof detail === "string" && detail.trim() ? detail : "模型请求失败",
        );
      }
      if (!response.body) throw new Error("模型服务未返回可读取的响应");

      const serverContextInputHeader = response.headers.get("X-MarkAI-Context-Input");
      const serverContextInputTokens =
        serverContextInputHeader === null ? Number.NaN : Number(serverContextInputHeader);
      if (Number.isFinite(serverContextInputTokens) && serverContextInputTokens >= 0) {
        inputTokens = Math.round(serverContextInputTokens);
      }
      const removedContextMessages = Number(response.headers.get("X-MarkAI-Context-Removed"));
      const contextContentTruncated = response.headers.get("X-MarkAI-Context-Truncated") === "1";
      if (removedContextMessages > 0 || contextContentTruncated) {
        const details = [
          removedContextMessages > 0 ? `${removedContextMessages} 条较早消息` : "",
          contextContentTruncated ? "过长的附件或消息内容" : "",
        ].filter(Boolean);
        if (!sessionId || useSessionStore.getState().activeSessionId === sessionId) {
          toast(`上下文已自动裁剪：${details.join("、")}`);
        }
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
        if (sessionId && useSessionStore.getState().activeSessionId !== sessionId) return;
        const extracted = extractThinkingFromText(plainContent);
        const eventReasoning = getAllReasoning();
        const reasoning = `${eventReasoning}${extracted.reasoning}`;
        const estimatedOutputTokens = estimateGeneratedOutputTokens();
        const nextOutputTokens = getResolvedOutputTokens(estimatedOutputTokens);
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
        if (extracted.content.trim() || reasoning.trim()) firstResponseTiming.committed();
      };

      updateStreamingMessage();

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
            if (lastSeg && lastSeg.type === "content" && lastSeg.stepId === execution.stepId) {
              lastSeg.content = lastSeg.content + newPart;
            } else {
              segments.push({
                type: "content",
                content: newPart,
                stepId: execution.stepId,
                phase: execution.contentPhase,
              });
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
        if (chunk.trim()) firstResponseTiming.text();
        reasoningController?.flush();
        if (contentController) {
          contentController.push(chunk);
          return;
        }
        commitContent(chunk);
      };

      const appendReasoning = (chunk: string) => {
        if (chunk.trim()) firstResponseTiming.text();
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
        if (event.type === "error") throw new GenerationError(event.text || "生成失败，请重试");
        if (event.type === "step" || event.type === "complete") {
          contentController?.flush();
          reasoningController?.flush();
          finishCurrentReasoning();
          currentThinkingSegment = undefined;
          execution.accept(event, segments);
          updateStreamingMessage();
          return;
        }
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
              s.type === "tool" &&
              (ws.callId
                ? s.webSearch.callId === ws.callId
                : s.webSearch.tool === ws.tool && s.webSearch.query === ws.query),
          );
          if (existingIdx >= 0) {
            (segments[existingIdx] as Extract<MessageSegment, { type: "tool" }>).webSearch = ws;
          } else {
            segments.push({ type: "tool", stepId: execution.toolStepId, webSearch: ws });
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
            const previous = (
              segments[existingIdx] as Extract<MessageSegment, { type: "generated-file" }>
            ).generatedFile;
            segments[existingIdx] = {
              stepId: execution.toolStepId,
              generatedFile: {
                ...previous,
                ...generatedFile,
                file: generatedFile.file || previous.file,
                preview: generatedFile.preview || previous.preview,
                progress:
                  generatedFile.status === "running"
                    ? undefined
                    : generatedFile.progress || previous.progress,
              },
              type: "generated-file",
            };
          } else {
            segments.push({ generatedFile, type: "generated-file", stepId: execution.toolStepId });
          }
          updateStreamingMessage();
          return;
        }
        if (event.type === "image" && event.generatedImage) {
          contentController?.flush();
          reasoningController?.flush();
          finishCurrentReasoning();
          currentThinkingSegment = undefined;
          segments.push({ generatedImage: event.generatedImage, type: "generated-image" });
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
      execution.assertComplete();
      controller.signal.throwIfAborted();
      await reasoningController?.finish();
      await contentController?.finish();
      segments.splice(
        0,
        segments.length,
        ...finishPendingExecutionTools(segments, "请求已结束，工具未完成，请重试"),
      );
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
      const finalOutputTokens = getResolvedOutputTokens(estimatedOutputTokens);
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
      segments.splice(
        0,
        segments.length,
        ...finishPendingExecutionTools(segments, "请求已停止，工具结果未完成，请重试"),
      );
      if (error instanceof DOMException && error.name === "AbortError") {
        outcome = "aborted";
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
        const finalOutputTokens = getResolvedOutputTokens(estimatedOutputTokens);
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
      finishCurrentReasoning();
      outcome = "failed";
      console.error("Chat error:", error);
      const failureMessage =
        (error instanceof GenerationError || isImageGenerationModel(modelConfig.id)) &&
        error instanceof Error &&
        error.message.trim()
          ? error.message
          : "生成失败，请稍后重试。";
      segments.push({ type: "error", content: failureMessage });
      if (!sessionId || useSessionStore.getState().activeSessionId === sessionId) {
        toast.error(failureMessage);
      }
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === modelMessageId &&
          (!sessionId || useSessionStore.getState().activeSessionId === sessionId)
            ? {
                ...m,
                content: segments
                  .filter((s) => s.type === "content")
                  .map((s) => s.content)
                  .join(""),
                segments: [...segments],
                interrupted: true,
                isReasoning: false,
              }
            : m,
        ),
      }));
      const errReasoning = getAllReasoning();
      return {
        content: segments
          .filter((s) => s.type === "content")
          .map((s) => s.content)
          .join(""),
        generationDuration: Date.now() - startedAt,
        inputTokens,
        isReasoning: false,
        interrupted: true,
        isStreaming: false,
        outputTokens: estimateTextTokens(
          segments
            .filter((s) => s.type === "content")
            .map((s) => s.content)
            .join(""),
        ),
        reasoning: errReasoning || undefined,
        segments: segments.length > 0 ? [...segments] : undefined,
        tokenUsageSource: "estimated",
        totalTokens:
          inputTokens +
          estimateTextTokens(
            segments
              .filter((s) => s.type === "content")
              .map((s) => s.content)
              .join(""),
          ),
      };
    } finally {
      if (typeof window !== "undefined") window.removeEventListener("pagehide", preserveOnPageHide);
      if (sessionId && sessionStreamControllers.get(sessionId) === controller) {
        sessionStreamControllers.delete(sessionId);
        const sessionStore = useSessionStore.getState();
        if (outcome === "aborted") {
          sessionStore.setSessionGenerationStatus(sessionId, undefined);
        } else if (outcome === "failed") {
          sessionStore.setSessionGenerationStatus(sessionId, "failed");
        } else if (
          (sessionStore.sessionNavigationTargetId || sessionStore.activeSessionId) === sessionId
        ) {
          sessionStore.setSessionGenerationStatus(sessionId, undefined);
        } else {
          sessionStore.setSessionGenerationStatus(sessionId, "unread");
        }
      }
      set((s) => ({
        ...(s.abortController === controller ? { isLoading: false, abortController: null } : {}),
        messages: s.messages.map((m) =>
          m.id === modelMessageId &&
          s.abortController === controller &&
          (!sessionId || useSessionStore.getState().activeSessionId === sessionId)
            ? {
                ...m,
                isReasoning: false,
                isStreaming: false,
                ...(outcome !== "completed" ? { interrupted: true } : {}),
              }
            : m,
        ),
      }));
    }
  };
