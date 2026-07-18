import { NextRequest, NextResponse } from "next/server";

import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { LOCAL_STORAGE_OWNER_ID } from "@/lib/auth-helpers";
import { findAvailableModel } from "@/lib/available-models";
import { prepareMessagesForContext } from "@/lib/chat/context-window";
import { estimateTextTokens } from "@/lib/chat/metrics";
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
import { getModelMetadata } from "@/lib/model-metadata";
import { injectFileContexts } from "@/lib/storage/file-context";

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
      return NextResponse.json({ error: "Chat payload is too large" }, { status: 413 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { messages, model, provider, timezone, webSearchEnabled } = body;
    const selectedModel = await findAvailableModel(model, provider, authorization.userId);

    if (!selectedModel) {
      return NextResponse.json({ error: "Model is not configured" }, { status: 400 });
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
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    const storageOwnerId = authorization.userId || (isLocalMode() ? LOCAL_STORAGE_OWNER_ID : null);
    const resolvedMessages = storageOwnerId
      ? await injectFileContexts(messages as ChatMessage[], storageOwnerId)
      : (messages as ChatMessage[]);
    const modelMetadata = getModelMetadata(selectedModel.id);
    const runtimeSystemPrompt = getRuntimeSystemPrompt({
      timezone,
      webSearchEnabled: selectedModel.runtime === "openai-compatible" && Boolean(webSearchEnabled),
    });
    const contextOverheadTokens =
      selectedModel.runtime === "openai-compatible"
        ? estimateTextTokens(
            JSON.stringify({
              messages: [{ content: runtimeSystemPrompt, role: "system" }],
              ...(webSearchEnabled
                ? { tool_choice: "auto", tools: [WEB_SEARCH_TOOL, READ_WEBPAGE_TOOL] }
                : {}),
            }),
          )
        : estimateTextTokens(
            JSON.stringify([
              { role: "user", parts: [{ text: runtimeSystemPrompt }] },
              { role: "model", parts: [{ text: "了解。" }] },
            ]),
          );
    const contextPreparation = modelMetadata
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
      );
    }

    return createGeminiStream({
      apiKey: selectedModel.apiKey,
      baseUrl: selectedModel.baseUrl,
      contextPreparation,
      messages: preparedMessages,
      model: selectedModel.id,
      systemPrompt: runtimeSystemPrompt,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
