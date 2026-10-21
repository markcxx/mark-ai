import { createAnthropicStream } from "./anthropic-runtime";
import type { ConfiguredModel } from "@/lib/models";
import { getThinkingPolicy } from "@/lib/model-thinking";
import { getToolSystemPrompt } from "@/lib/tools/registry";
import { createOpenAICompatibleStream } from "./openai-runtime";
import { createGeminiStream } from "./gemini-runtime";

export type ChartTestAttempt = {
  index: number;
  raw: string;
  error?: string;
  validation?: "render" | "structure";
};

// Use the same streaming/tool loop as a real conversation, without saving a test session.
export async function runChartTest({
  model,
  prompt,
  signal,
  userId,
  thinkingEnabled,
}: {
  model: ConfiguredModel;
  prompt: string;
  signal: AbortSignal;
  userId?: string;
  thinkingEnabled?: boolean;
}) {
  const skillPrompt = getToolSystemPrompt(["data-visualization"]);
  const messages = [{ role: "user" as const, content: prompt }];
  const toolRuntime = {
    enabledToolIds: ["data-visualization"],
    sessionId: "dev-chart-test",
    userId: userId || "dev-chart-test",
    skillPrompt,
    debugChartAttempts: true,
  };
  if (model.runtime === "gemini")
    return createGeminiStream({
      apiKey: model.apiKey,
      baseUrl: model.baseUrl,
      model: model.id,
      messages,
      systemPrompt: skillPrompt,
      signal,
      toolRuntime,
    });
  const createStream =
    model.runtime === "anthropic" ? createAnthropicStream : createOpenAICompatibleStream;
  return createStream(
    messages,
    model.id,
    model.apiKey,
    model.baseUrl,
    false,
    undefined,
    signal,
    undefined,
    toolRuntime,
    { policy: getThinkingPolicy(model), enabled: thinkingEnabled },
  );
}
