export type ModelRuntime = "gemini" | "openai-compatible" | "anthropic";

export function normalizeModelRuntime(value?: string): ModelRuntime {
  const runtime = value?.trim().toLowerCase();
  if (runtime === "gemini") return "gemini";
  if (["anthropic", "anthropic-messages", "messages"].includes(runtime || "")) return "anthropic";
  return "openai-compatible";
}

/** Mixed gateways can require a different wire protocol for individual models. */
export function resolveModelRuntime(model: {
  id: string;
  baseUrl?: string;
  runtime?: string;
}): ModelRuntime {
  const runtime = normalizeModelRuntime(model.runtime);
  if (runtime !== "openai-compatible") return runtime;
  try {
    const url = new URL(model.baseUrl || "");
    if (
      (url.hostname === "api.commandcode.ai" || url.hostname === "api.anthropic.com") &&
      /^(?:anthropic\/)?claude-/i.test(model.id)
    )
      return "anthropic";
  } catch {
    /* An invalid address is reported by the request handler. */
  }
  return runtime;
}
