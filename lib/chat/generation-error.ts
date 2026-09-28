/** Public error text only; never forward raw provider response bodies. */
export class GenerationError extends Error {}

const redactProviderMessage = (message: string, secrets: string[]) => {
  let safe = message;
  for (const secret of secrets) {
    if (secret) safe = safe.split(secret).join("[已隐藏]");
  }
  return safe
    .replace(/https?:\/\/[^\s<>"']+/gi, "[地址已隐藏]")
    .replace(/\bBearer\s+[^\s,"'}]+/gi, "Bearer [已隐藏]")
    .replace(/\b(?:sk-[\w-]+|AIza[\w-]+)/g, "[已隐藏]")
    .replace(
      /((?:api[_ -]?key|access[_ -]?token|authorization|password|secret)\s*[=:]\s*)["']?[^\s,"'}]+["']?/gi,
      "$1[已隐藏]",
    )
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 1500);
};

export function describeGenerationError(error: unknown, secrets: string[] = []): string {
  let providerMessage = false;
  let value: unknown = error instanceof Error ? error.message : error;
  let status = Number((error as { status?: number })?.status) || 0;
  for (let depth = 0; depth < 5; depth++) {
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        break;
      }
    } else if (Array.isArray(value)) value = value[0];
    else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      status = Number(record.code || record.status) || status;
      if (!record.error && typeof record.message === "string") providerMessage = true;
      value = record.error || record.message || "";
    } else break;
  }
  const message = typeof value === "string" ? value : "";
  const suffix = status >= 400 && status <= 599 ? `（${status}）` : "";
  // Prefer the provider's explicit message over a lossy category summary.
  if (providerMessage && message.trim() && !/<(?:html|!doctype)/i.test(message)) {
    return `生成失败：${redactProviderMessage(message, secrets)}${suffix}`;
  }
  if (/high demand|overloaded|UNAVAILABLE|capacity/i.test(message) || status === 503)
    return `模型服务当前繁忙，暂时无法生成，请稍后重试或切换模型${suffix}。`;
  if (/quota|insufficient|billing|credit|余额|额度/i.test(message))
    return `模型服务额度不足，请检查额度或联系管理员${suffix}。`;
  if (status === 429 || /rate.limit|too many requests/i.test(message))
    return `请求过于频繁，已触发模型服务限流，请稍后重试${suffix}。`;
  if (
    [401, 403].includes(status) ||
    /api.key|unauthorized|authentication|permission/i.test(message)
  )
    return `模型服务认证或权限校验失败，请检查服务商配置或联系管理员${suffix}。`;
  if (/context|token.*limit|too long/i.test(message))
    return `对话或输出长度超过模型限制，请缩短内容或开启新对话${suffix}。`;
  if (/safety|blocked|policy|content.filter/i.test(message))
    return `请求被模型服务的内容安全规则拦截，请调整内容后重试${suffix}。`;
  if (status === 404 || /model.*not.*found/i.test(message))
    return `模型不存在或当前不可用，请检查模型配置${suffix}。`;
  if (/timeout|timed out|ETIMEDOUT/i.test(message))
    return `模型服务响应超时，请稍后重试${suffix}。`;
  if (/fetch failed|network|ECONN|ENOTFOUND/i.test(message))
    return "无法连接模型服务，请稍后重试或联系管理员检查连接。";
  if (status >= 500) return `模型服务发生内部错误，请稍后重试${suffix}。`;
  // Unknown messages may contain credentials, prompts or internal URLs.
  return `生成失败，模型服务未能完成请求，请重试或联系管理员${suffix}。`;
}
