import { GoogleGenAI } from "@google/genai";

import { findConfiguredModel, getConfiguredModels } from "@/lib/models";

import type { Message } from "./types";

const TITLE_PROMPT = `You are a professional conversation summarizer. Generate a concise title that captures the essence of the conversation.

Rules:
- Output ONLY the title text, no explanations or additional context
- Maximum 15 words
- Maximum 80 characters
- No punctuation marks
- Use the language specified by the locale code: zh-CN
- The title should accurately reflect the main topic of the conversation
- Keep it short and to the point`;

const toOpenAIChatEndpoint = (baseUrl?: string) => {
  if (!baseUrl) return undefined;

  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
};

type TitleModelResolution = {
  matchedBy?: "exact" | "model-id";
  model?: ReturnType<typeof getConfiguredModels>[number];
  reason?: string;
  requested?: string;
};

const resolveTitleModelConfig = (): TitleModelResolution => {
  const raw =
    process.env.MARKAI_CONVERSATION_TITLE_MODEL?.trim() || process.env.MARKAI_TITLE_MODEL?.trim();

  if (!raw) return { reason: "MARKAI_CONVERSATION_TITLE_MODEL is not configured" };

  const separatorIndex = raw.indexOf("/");
  if (separatorIndex <= 0 || separatorIndex === raw.length - 1) {
    return { reason: "Title model must use provider/modelId format", requested: raw };
  }

  const provider = raw.slice(0, separatorIndex).trim().toLowerCase();
  const modelId = raw.slice(separatorIndex + 1).trim();
  const exactModel = findConfiguredModel(modelId, provider);

  if (exactModel) {
    return { matchedBy: "exact", model: exactModel, requested: raw };
  }

  const sameIdModels = getConfiguredModels().filter((model) => model.id === modelId);
  if (sameIdModels.length === 1) {
    return { matchedBy: "model-id", model: sameIdModels[0], requested: raw };
  }

  return {
    reason:
      sameIdModels.length > 1
        ? `Model id "${modelId}" is configured by multiple providers`
        : `No configured model matches "${raw}"`,
    requested: raw,
  };
};

const sanitizeTitle = (value: string) =>
  value
    .replace(/^["'“”‘’]+|["'“”‘’。.!！?？]+$/g, "")
    .replace(/[。.!！?？；;：:]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .slice(0, 40);

export const getFallbackConversationTitle = (messages: Message[]) => {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content || "";
  const title = sanitizeTitle(firstUserMessage)
    .replace(/^(我想知道|我想了解|请问|帮我|帮忙|麻烦|能不能|可以|请|关于)/, "")
    .replace(/[，,。.!！?？；;：:、]/g, "")
    .slice(0, 16);

  return title || "新对话";
};

export const generateConversationTitle = async (messages: Message[], fallbackTitle?: string) => {
  const fallback = fallbackTitle?.trim() || getFallbackConversationTitle(messages);
  const resolution = resolveTitleModelConfig();
  const selectedModel = resolution.model;
  const titleModel = {
    matchedBy: resolution.matchedBy,
    model: selectedModel?.id,
    provider: selectedModel?.provider,
    reason: resolution.reason,
    requested: resolution.requested,
    used: false,
  };

  if (!selectedModel) return { title: fallback, titleModel };

  const transcript = messages
    .filter((message) => message.content.trim())
    .slice(0, 6)
    .map((message) => {
      const role = message.role === "model" ? "assistant" : "user";
      return `<${role}>\n${message.content}\n</${role}>`;
    })
    .join("\n\n")
    .slice(0, 4000);
  const titleTask = `<task>
Generate a concise title that captures the essence of the conversation.
</task>

<conversation>
${transcript}
</conversation>`;

  try {
    if (selectedModel.runtime === "openai-compatible") {
      const endpoint = toOpenAIChatEndpoint(selectedModel.baseUrl);
      if (!endpoint)
        return { title: fallback, titleModel: { ...titleModel, reason: "No endpoint configured" } };

      const response = await fetch(endpoint, {
        body: JSON.stringify({
          max_tokens: 64,
          messages: [
            { content: TITLE_PROMPT, role: "system" },
            { content: titleTask, role: "user" },
          ],
          model: selectedModel.id,
          stream: false,
          temperature: 0.2,
        }),
        headers: {
          Authorization: `Bearer ${selectedModel.apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        return {
          title: fallback,
          titleModel: {
            ...titleModel,
            reason: `Title model request failed with status ${response.status}`,
          },
        };
      }

      const data = await response.json();
      const title = sanitizeTitle(data?.choices?.[0]?.message?.content || "");
      return { title: title || fallback, titleModel: { ...titleModel, used: Boolean(title) } };
    }

    const ai = new GoogleGenAI({
      apiKey: selectedModel.apiKey,
      ...(selectedModel.baseUrl ? { httpOptions: { baseUrl: selectedModel.baseUrl } } : {}),
    });

    const response = await ai.models.generateContent({
      contents: [{ parts: [{ text: `${TITLE_PROMPT}\n\n${titleTask}` }], role: "user" }],
      model: selectedModel.id,
    });

    const title = sanitizeTitle(response.text || "");
    return { title: title || fallback, titleModel: { ...titleModel, used: Boolean(title) } };
  } catch (error) {
    console.error("Conversation title generation failed:", error);
    return {
      title: fallback,
      titleModel: {
        ...titleModel,
        reason: error instanceof Error ? error.message : "Title model request failed",
      },
    };
  }
};
