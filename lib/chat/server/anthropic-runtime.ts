import { createOpenAICompatibleStream } from "./openai-runtime";
import { createAnthropicTransport, toAnthropicMessagesEndpoint } from "./anthropic-transport";
import { readProviderResponseError } from "../generation-error";
import type { ConfiguredModel } from "@/lib/models";
import type { OpenAIChatMessage } from "./types";

export function createAnthropicStream(...args: Parameters<typeof createOpenAICompatibleStream>) {
  const [messages, model, apiKey, baseUrl, webSearch, timezone, signal, context, tools, thinking] =
    args;
  return createOpenAICompatibleStream(
    messages,
    model,
    apiKey,
    baseUrl || "https://api.anthropic.com/v1",
    webSearch,
    timezone,
    signal,
    context,
    tools,
    thinking,
    createAnthropicTransport({ apiKey, baseUrl }),
  );
}

export async function generateAnthropicText(
  model: ConfiguredModel,
  messages: OpenAIChatMessage[],
  maxTokens: number,
) {
  const response = await createAnthropicTransport(model)(
    toAnthropicMessagesEndpoint(model.baseUrl),
    {
      method: "POST",
      body: JSON.stringify({ model: model.id, messages, max_tokens: maxTokens, stream: false }),
    },
  );
  if (!response.ok) throw await readProviderResponseError(response, [model.apiKey]);
  const payload = await response.json();
  return String(payload.choices?.[0]?.message?.content || "");
}
