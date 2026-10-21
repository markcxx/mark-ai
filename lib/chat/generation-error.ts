/** Preserve upstream error details in every environment, with credentials redacted. */
export class GenerationError extends Error {}

const redactProviderMessage = (message: string, secrets: string[]) => {
  let safe = message;
  for (const secret of secrets) {
    if (secret) safe = safe.split(secret).join("[已隐藏]");
  }
  return safe
    .replace(/\bBearer\s+[^\s,"'}]+/gi, "Bearer [已隐藏]")
    .replace(/\b(?:sk-[\w-]+|AIza[\w-]+)/g, "[已隐藏]")
    .replace(
      /((?:api[_ -]?key|access[_ -]?token|authorization|password|secret)["']?\s*[=:]\s*["']?)[^\s,"'}]+/gi,
      "$1[已隐藏]",
    )
    .replace(
      /([?&](?:key|api_key|access_token|token|password|secret)=)[^&#\s"'<>]+/gi,
      "$1[已隐藏]",
    )
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[已隐藏]@")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
};

export function describeGenerationError(error: unknown, secrets: string[] = []): string {
  const value = error instanceof Error ? error.message : error;
  let raw = "";
  if (typeof value === "string") raw = value;
  else if (value != null) {
    try {
      raw = JSON.stringify(value, null, 2);
    } catch {
      raw = String(value);
    }
  }
  let status = Number((error as { status?: number } | null)?.status) || 0;
  // Read a nested status without discarding the provider's JSON, codes or request IDs.
  let detail: unknown = value;
  for (let depth = 0; depth < 8 && !(status >= 400 && status <= 599); depth++) {
    if (typeof detail === "string") {
      try {
        detail = JSON.parse(detail);
      } catch {
        break;
      }
    } else if (Array.isArray(detail)) detail = detail[0];
    else if (detail && typeof detail === "object") {
      const record = detail as Record<string, unknown>;
      status =
        [record.status, record.code].map(Number).find((value) => value >= 400 && value <= 599) || 0;
      detail = record.error || record.message;
    } else break;
  }
  const message = redactProviderMessage(raw, secrets);
  const http = status >= 400 && status <= 599 ? `HTTP ${status}` : "";
  return [http, message].filter(Boolean).join("\n") || "未知错误（服务商未返回错误详情）";
}

/** Read a failed HTTP response without summarizing or truncating its body. */
export async function readProviderResponseError(response: Response, secrets: string[] = []) {
  const body = await response.text();
  return Object.assign(new Error(redactProviderMessage(body, secrets)), {
    status: response.status,
  });
}
