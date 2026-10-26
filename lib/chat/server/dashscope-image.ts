import { isDashScopeImageModel } from "../image-models";
import {
  describeGenerationError,
  GenerationError,
  readProviderResponseError,
} from "../generation-error";
import { fetchWithDevelopmentProxy } from "@/lib/server/development-proxy";

const IMAGE_PATH = "/api/v1/services/aigc/multimodal-generation/generation";

export const usesDashScopeImageApi = (model: string, baseUrl?: string) => {
  if (!isDashScopeImageModel(model)) return false;
  if (!baseUrl) return true;
  try {
    const url = new URL(baseUrl);
    return (
      url.hostname.endsWith(".aliyuncs.com") || url.pathname.replace(/\/+$/, "") === IMAGE_PATH
    );
  } catch {
    return false;
  }
};

const getImageEndpoint = (baseUrl?: string) => {
  const url = new URL(baseUrl || "https://dashscope.aliyuncs.com");
  url.pathname = IMAGE_PATH;
  url.hash = "";
  return url.toString();
};

type DashScopeImagePayload = {
  code?: string;
  message?: string;
  output?: {
    choices?: Array<{
      message?: { content?: Array<{ image?: string; text?: string }> };
    }>;
  };
};

/** DashScope's synchronous image API accepts text and reference images in one message. */
export const generateDashScopeImage = async ({
  apiKey,
  baseUrl,
  model,
  prompt,
  sourceImage,
  signal,
}: {
  apiKey: string;
  baseUrl?: string;
  model: string;
  prompt: string;
  sourceImage?: { bytes: Uint8Array; contentType: string };
  signal: AbortSignal;
}): Promise<{ url: string }> => {
  const content: Array<{ image: string } | { text: string }> = [];
  if (sourceImage) {
    content.push({
      image: `data:${sourceImage.contentType};base64,${Buffer.from(sourceImage.bytes).toString("base64")}`,
    });
  }
  content.push({ text: prompt });

  const response = await fetchWithDevelopmentProxy(getImageEndpoint(baseUrl), {
    body: JSON.stringify({
      model,
      input: { messages: [{ role: "user", content }] },
      parameters: { n: 1, size: "1024*1024", watermark: false },
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });
  if (!response.ok) throw await readProviderResponseError(response, [apiKey]);

  const payload = (await response.json()) as DashScopeImagePayload;
  if (payload.code) {
    throw new GenerationError(describeGenerationError(payload, [apiKey]));
  }
  const image = payload.output?.choices
    ?.flatMap((choice) => choice.message?.content || [])
    .find((part) => typeof part.image === "string" && part.image.trim())?.image;
  if (!image) throw new Error("图片服务未返回生成结果，请调整描述或参考图片后重试");
  return { url: image };
};
