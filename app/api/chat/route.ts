import { NextRequest, NextResponse } from "next/server";

import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { LOCAL_STORAGE_OWNER_ID } from "@/lib/auth-helpers";
import { findAvailableModel } from "@/lib/available-models";
import { prepareMessagesForContext } from "@/lib/chat/context-window";
import { estimateTextTokens } from "@/lib/chat/metrics";
import { getChatSession } from "@/lib/chat/storage";
import { createGeminiStream } from "@/lib/chat/server/gemini-runtime";
import { createOpenAICompatibleStream } from "@/lib/chat/server/openai-runtime";
import {
  getRuntimeSystemPrompt,
  READ_WEBPAGE_TOOL,
  WEB_SEARCH_TOOL,
} from "@/lib/chat/server/runtime-prompt";
import type { ChatMessage } from "@/lib/chat/server/types";
import type { FileAttachment } from "@/lib/chat/types";
import { isLocalMode } from "@/lib/env";
import { getModelMetadata, hasKnownContextWindow } from "@/lib/model-metadata";
import { injectFileContexts } from "@/lib/storage/file-context";
import {
  getAvailableBuiltinTool,
  getToolFunctions,
  getToolSystemPrompt,
} from "@/lib/tools/registry";
import { listInstalledToolIds, listSessionEnabledToolIds } from "@/lib/tools/storage";

const MAX_CHAT_MESSAGES = 200;
const MAX_CHAT_MESSAGE_CHARS = 200_000;
const MAX_CHAT_PAYLOAD_BYTES = 2_000_000;

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorizeApiRequest(req);
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

    const { messages, model, provider, sessionId, timezone, webSearchEnabled } = body;
    const selectedModel = await findAvailableModel(model, provider, authorization.userId);

    if (!selectedModel) {
      return NextResponse.json({ error: "所选模型尚未配置或不可用" }, { status: 400 });
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
          (!message.attachments ||
            (Array.isArray(message.attachments) &&
              message.attachments.length <= 4 &&
              message.attachments.every(
                (file: unknown) =>
                  file &&
                  typeof file === "object" &&
                  typeof (file as FileAttachment).id === "string",
              ))),
      )
    ) {
      return NextResponse.json({ error: "消息内容为空、过长或格式无效" }, { status: 400 });
    }

    const storageOwnerId = authorization.userId || (isLocalMode() ? LOCAL_STORAGE_OWNER_ID : null);
    if (!storageOwnerId) {
      return NextResponse.json({ error: "无法确认当前存储用户，请重新登录" }, { status: 401 });
    }

    let enabledToolIds: string[] = [];
    if (typeof sessionId === "string" && sessionId) {
      const session = await getChatSession(sessionId, authorization.userId);
      if (!session) return NextResponse.json({ error: "会话不存在或无权访问" }, { status: 404 });

      const [sessionToolIds, installedToolIds] = await Promise.all([
        listSessionEnabledToolIds(storageOwnerId, sessionId),
        listInstalledToolIds(storageOwnerId),
      ]);
      const installed = new Set(installedToolIds);
      enabledToolIds = sessionToolIds.filter(
        (toolId) => installed.has(toolId) && Boolean(getAvailableBuiltinTool(toolId)),
      );
    }

    const skillPrompt = getToolSystemPrompt(enabledToolIds);
    const builtinToolSchemas = getToolFunctions(enabledToolIds).map((toolFunction) => ({
      function: toolFunction,
      type: "function",
    }));
    const resolvedMessages = storageOwnerId
      ? await injectFileContexts(messages as ChatMessage[], storageOwnerId)
      : (messages as ChatMessage[]);
    const modelMetadata = getModelMetadata(selectedModel.id);
    const runtimeSystemPrompt = getRuntimeSystemPrompt({
      skillPrompt,
      timezone,
      webSearchEnabled: selectedModel.runtime === "openai-compatible" && Boolean(webSearchEnabled),
    });
    const contextOverheadTokens =
      selectedModel.runtime === "openai-compatible"
        ? estimateTextTokens(
            JSON.stringify({
              messages: [{ content: runtimeSystemPrompt, role: "system" }],
              ...(webSearchEnabled || builtinToolSchemas.length > 0
                ? {
                    tool_choice: "auto",
                    tools: [
                      ...(webSearchEnabled ? [WEB_SEARCH_TOOL, READ_WEBPAGE_TOOL] : []),
                      ...builtinToolSchemas,
                    ],
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
              ...(builtinToolSchemas.length > 0
                ? {
                    tools: [
                      { functionDeclarations: builtinToolSchemas.map((tool) => tool.function) },
                    ],
                  }
                : {}),
            }),
          );
    const contextPreparation = hasKnownContextWindow(modelMetadata)
      ? prepareMessagesForContext(resolvedMessages, modelMetadata, contextOverheadTokens)
      : undefined;
    const preparedMessages = contextPreparation?.messages || resolvedMessages;

    if (selectedModel.runtime === "openai-compatible") {
      return createOpenAICompatibleStream(
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
      );
    }

    return createGeminiStream({
      apiKey: selectedModel.apiKey,
      baseUrl: selectedModel.baseUrl,
      contextPreparation,
      messages: preparedMessages,
      model: selectedModel.id,
      signal: req.signal,
      systemPrompt: runtimeSystemPrompt,
      toolRuntime:
        typeof sessionId === "string" && sessionId
          ? { enabledToolIds, sessionId, userId: storageOwnerId }
          : undefined,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "生成回复失败，请稍后重试" }, { status: 500 });
  }
}
