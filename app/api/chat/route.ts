import { createRequestTiming } from "@/lib/chat/server/request-timing";
import { describeGenerationError } from "@/lib/chat/generation-error";
import { getThinkingPolicy } from "@/lib/model-thinking";
import { after, NextRequest, NextResponse } from "next/server";

import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { LOCAL_STORAGE_OWNER_ID } from "@/lib/auth-helpers";
import { findAvailableModel } from "@/lib/available-models";
import { prepareMessagesForContext } from "@/lib/chat/context-window";
import { normalizeWebResourceContext } from "@/lib/chat/web-context";
import { prepareRequestHistory } from "@/lib/chat/request-history";
import { estimateTextTokens } from "@/lib/chat/metrics";
import { isImageGenerationModel } from "@/lib/chat/image-models";
import { getChatSession } from "@/lib/chat/storage";
import { getRuntimeSystemPrompt, WEB_TOOLS } from "@/lib/chat/server/runtime-prompt";
import type { ChatMessage } from "@/lib/chat/server/types";
import type { FileAttachment } from "@/lib/chat/types";
import { isLocalMode } from "@/lib/env";
import { hasKnownContextWindow } from "@/lib/model-metadata";
import { getServerModelMetadata } from "@/lib/server/model-catalog";
import {
  getAvailableBuiltinTool,
  getToolFunctions,
  getToolSystemPrompt,
} from "@/lib/tools/registry";
import { listUsableSessionToolIds } from "@/lib/tools/storage";

const MAX_CHAT_MESSAGES = 200;
const MAX_CHAT_MESSAGE_CHARS = 200_000;
const MAX_CHAT_PAYLOAD_BYTES = 2_000_000;

export async function POST(req: NextRequest) {
  const timing = createRequestTiming();
  try {
    const authorization = await timing.measure("auth", () =>
      authorizeApiRequest(req, { deferPlatformRecord: after }),
    );
    if (!authorization.authorized) return authorization.response;
    const limited = enforceRateLimit({ key: authorization.key, limit: 30, scope: "chat" });
    if (limited) return limited;

    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_CHAT_PAYLOAD_BYTES) {
      return NextResponse.json({ error: "对话内容过大，请缩短消息后重试" }, { status: 413 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "请求内容格式无效" }, { status: 400 });
    }

    const { messages, model, provider, sessionId, timezone, webSearchEnabled, thinkingEnabled } =
      body;
    if (thinkingEnabled !== undefined && typeof thinkingEnabled !== "boolean") {
      return NextResponse.json({ error: "思考模式参数无效，请刷新后重试" }, { status: 400 });
    }

    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > MAX_CHAT_MESSAGES ||
      !messages.every(
        (message) =>
          message &&
          typeof message === "object" &&
          (message.role === "user" || message.role === "model") &&
          typeof message.content === "string" &&
          message.content.length <= MAX_CHAT_MESSAGE_CHARS &&
          (message.reasoning === undefined ||
            (typeof message.reasoning === "string" &&
              message.reasoning.length <= MAX_CHAT_MESSAGE_CHARS)) &&
          (!message.attachments ||
            (Array.isArray(message.attachments) &&
              message.attachments.length <= 4 &&
              message.attachments.every(
                (file: unknown) =>
                  file &&
                  typeof file === "object" &&
                  typeof (file as FileAttachment).id === "string",
              ))) &&
          (!message.generatedImageIds ||
            (Array.isArray(message.generatedImageIds) &&
              message.generatedImageIds.length <= 4 &&
              message.generatedImageIds.every((id: unknown) => typeof id === "string"))),
      )
    ) {
      return NextResponse.json({ error: "消息内容为空、过长或格式无效" }, { status: 400 });
    }

    const storageOwnerId = authorization.userId || (isLocalMode() ? LOCAL_STORAGE_OWNER_ID : null);
    if (!storageOwnerId) {
      return NextResponse.json({ error: "无法确认当前存储用户，请重新登录" }, { status: 401 });
    }

    const hasSession = typeof sessionId === "string" && Boolean(sessionId);
    const [selectedModel, session, sessionToolIds] = await Promise.all([
      timing.measure("model", () =>
        findAvailableModel(model, provider, authorization.userId, thinkingEnabled !== undefined),
      ),
      timing.measure("session", () =>
        hasSession ? getChatSession(sessionId, authorization.userId) : undefined,
      ),
      timing.measure("tools", () =>
        hasSession ? listUsableSessionToolIds(storageOwnerId, sessionId) : [],
      ),
    ]);
    if (!selectedModel)
      return NextResponse.json(
        {
          error:
            thinkingEnabled !== undefined
              ? "所选模型暂无支持思考切换的可用线路，请刷新模型列表后重试"
              : "所选模型尚未配置或不可用",
        },
        { status: 400 },
      );
    if (hasSession && !session)
      return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });

    if (isImageGenerationModel(selectedModel.id)) {
      try {
        const { generateOrEditImage } = await import("@/lib/chat/server/image-runtime");
        const generatedImage = await generateOrEditImage({
          apiKey: selectedModel.apiKey,
          baseUrl: selectedModel.baseUrl,
          messages: messages as ChatMessage[],
          model: selectedModel.id,
          signal: req.signal,
          userId: storageOwnerId,
        });
        return new Response(`${JSON.stringify({ generatedImage, type: "image" })}\n`, {
          headers: {
            "Cache-Control": "no-cache, no-transform",
            "Content-Type": "application/x-ndjson; charset=utf-8",
          },
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        console.error("Image generation error:", error);
        return NextResponse.json(
          { error: describeGenerationError(error, [selectedModel.apiKey]) },
          { status: 502 },
        );
      }
    }

    const enabledToolIds = sessionToolIds.filter((toolId) =>
      Boolean(getAvailableBuiltinTool(toolId)),
    );

    const skillPrompt = getToolSystemPrompt(enabledToolIds);
    const builtinToolSchemas = getToolFunctions(enabledToolIds).map((toolFunction) => ({
      function: toolFunction,
      type: "function",
    }));
    const thinkingPolicy = getThinkingPolicy(selectedModel);
    const retainReasoning = Boolean(
      thinkingPolicy && (thinkingEnabled ?? thinkingPolicy.defaultEnabled),
    );
    // Also sanitize on the server for older web/mobile clients and already affected sessions.
    const requestHistory = prepareRequestHistory(
      (messages as ChatMessage[]).map((message) => ({
        ...message,
        webContext: normalizeWebResourceContext(message.webContext),
      })),
    );
    if (!requestHistory.length || requestHistory.at(-1)?.role !== "user") {
      return NextResponse.json({ error: "缺少有效的用户消息，请重新发送" }, { status: 400 });
    }
    const [fileMessages, modelMetadata] = await Promise.all([
      timing.measure("files", async () => {
        if (!requestHistory.some((message) => message.attachments?.length)) return requestHistory;
        const { injectFileContexts } = await import("@/lib/storage/file-context");
        return injectFileContexts(requestHistory, storageOwnerId);
      }),
      timing.measure("metadata", () => getServerModelMetadata(selectedModel)),
    ]);
    const resolvedMessages = fileMessages.map((message) => ({
      ...message,
      reasoning: retainReasoning && message.role === "model" ? message.reasoning : undefined,
    }));
    const runtimeSystemPrompt = getRuntimeSystemPrompt({
      skillPrompt,
      timezone,
      webSearchEnabled: Boolean(webSearchEnabled),
    });
    const contextOverheadTokens =
      selectedModel.runtime !== "gemini"
        ? estimateTextTokens(
            JSON.stringify({
              messages: [{ content: runtimeSystemPrompt, role: "system" }],
              ...(webSearchEnabled || builtinToolSchemas.length > 0
                ? {
                    tool_choice: "auto",
                    tools: [...(webSearchEnabled ? WEB_TOOLS : []), ...builtinToolSchemas],
                  }
                : {}),
            }),
          )
        : estimateTextTokens(
            JSON.stringify({
              contents: [
                { role: "user", parts: [{ text: runtimeSystemPrompt }] },
                { role: "model", parts: [{ text: "了解。" }] },
              ],
              ...(builtinToolSchemas.length > 0 || webSearchEnabled
                ? {
                    tools: [
                      {
                        functionDeclarations: [
                          ...(webSearchEnabled ? WEB_TOOLS.map((tool) => tool.function) : []),
                          ...builtinToolSchemas.map((tool) => tool.function),
                        ],
                      },
                    ],
                  }
                : {}),
            }),
          );
    const contextPreparation = hasKnownContextWindow(modelMetadata)
      ? prepareMessagesForContext(resolvedMessages, modelMetadata, contextOverheadTokens)
      : undefined;
    const preparedMessages = contextPreparation?.messages || resolvedMessages;

    if (selectedModel.runtime !== "gemini") {
      const createStream =
        selectedModel.runtime === "anthropic"
          ? (await import("@/lib/chat/server/anthropic-runtime")).createAnthropicStream
          : (await import("@/lib/chat/server/openai-runtime")).createOpenAICompatibleStream;
      return timing.response(
        await createStream(
          preparedMessages,
          selectedModel.id,
          selectedModel.apiKey,
          selectedModel.baseUrl,
          Boolean(webSearchEnabled),
          timezone,
          req.signal,
          contextPreparation,
          typeof sessionId === "string" && sessionId
            ? {
                enabledToolIds,
                sessionId,
                skillPrompt,
                userId: storageOwnerId,
              }
            : undefined,
          { policy: thinkingPolicy, enabled: thinkingEnabled },
        ),
      );
    }

    const { createGeminiStream } = await import("@/lib/chat/server/gemini-runtime");
    return timing.response(
      await createGeminiStream({
        apiKey: selectedModel.apiKey,
        baseUrl: selectedModel.baseUrl,
        contextPreparation,
        includeThoughts: modelMetadata?.supportsReasoning !== false,
        messages: preparedMessages,
        model: selectedModel.id,
        signal: req.signal,
        systemPrompt: runtimeSystemPrompt,
        webSearchEnabled: Boolean(webSearchEnabled),
        toolRuntime:
          typeof sessionId === "string" && sessionId
            ? { enabledToolIds, sessionId, userId: storageOwnerId }
            : undefined,
      }),
    );
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: describeGenerationError(error) }, { status: 500 });
  }
}
