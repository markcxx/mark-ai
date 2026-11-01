/** Model author, independent of the configured API gateway/provider. */
export function getModelDeveloper(modelId: string) {
  const id = modelId.toLowerCase().split("/").pop() ?? modelId;
  const developers: [RegExp, string, string][] = [
    [/^(gpt|o[1-9]|chatgpt)/, "openai", "OpenAI"],
    [/^claude/, "anthropic", "Anthropic"],
    [/^(gemini|gemma)/, "google", "Google"],
    [/^grok/, "xai", "xAI"],
    [/^deepseek/, "deepseek", "DeepSeek"],
    [/^(qwen|wan\d)/, "alibaba", "阿里巴巴 · Qwen"],
    [/^glm/, "zhipu", "智谱 · GLM"],
    [/^kimi/, "moonshot", "月之暗面 · Kimi"],
    [/^minimax/, "minimax", "MiniMax"],
    [/^mimo/, "xiaomi", "小米 · MiMo"],
    [/^doubao/, "bytedance", "字节跳动 · 豆包"],
    [/^(llama|muse)/, "meta", "Meta"],
  ];
  const match = developers.find(([pattern]) => pattern.test(id));
  return match ? { id: match[1], name: match[2] } : { id: "other", name: "其他厂商" };
}
