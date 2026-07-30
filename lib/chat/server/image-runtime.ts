import { getStoredFileBytes, getStoredFilesByIds } from "@/lib/storage/file-storage";
import { saveGeneratedFile } from "@/lib/tools/generated-file";
import { fetchWithDevelopmentProxy } from "@/lib/server/development-proxy";

import type { GeneratedImageState } from "../types";
import type { ChatMessage } from "./types";

type ImageApiPayload = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
  error?: { message?: string } | string;
};

type ImageFormat = {
  contentType: string;
  extension: string;
};

export const getOpenAIImageEndpoint = (
  baseUrl: string | undefined,
  operation: "edits" | "generations",
) => {
  const normalized = (baseUrl || "https://api.openai.com/v1")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/, "");
  return `${normalized}/images/${operation}`;
};

export const detectGeneratedImageFormat = (bytes: Uint8Array): ImageFormat => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: ".jpg" };
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: ".webp" };
  }
  return { contentType: "image/png", extension: ".png" };
};

const getProviderError = async (response: Response) => {
  const raw = await response.text().catch(() => "");
  try {
    const payload = JSON.parse(raw) as ImageApiPayload;
    if (typeof payload.error === "string") return payload.error;
    return payload.error?.message || raw;
  } catch {
    return raw;
  }
};

const readGeneratedBytes = async (
  item: NonNullable<ImageApiPayload["data"]>[number],
  signal: AbortSignal,
) => {
  if (item.b64_json) return new Uint8Array(Buffer.from(item.b64_json, "base64"));
  if (!item.url) throw new Error("图片服务未返回图片数据");

  const response = await fetchWithDevelopmentProxy(item.url, { signal });
  if (!response.ok) throw new Error("图片服务返回的临时图片无法下载");
  return new Uint8Array(await response.arrayBuffer());
};

const findSourceImage = async (messages: ChatMessage[], userId: string) => {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const currentAttachmentIds = latestUserMessage?.attachments?.map((file) => file.id) || [];
  const currentAttachments = await getStoredFilesByIds(currentAttachmentIds, userId);
  const currentImage = currentAttachments.find((file) => file.contentType.startsWith("image/"));
  if (currentImage) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(currentImage.contentType)) {
      throw new Error("图片编辑仅支持 PNG、JPEG 或 WebP 图片");
    }
    return currentImage;
  }
  if (currentAttachmentIds.length > 0) {
    throw new Error("图片生成模型只能将图片附件用于编辑，请移除其他附件后重试");
  }

  const latestGeneratedId = [...messages]
    .reverse()
    .flatMap((message) => message.generatedImageIds || [])
    .at(0);
  if (!latestGeneratedId) return undefined;

  const [generatedImage] = await getStoredFilesByIds([latestGeneratedId], userId);
  return generatedImage?.contentType.startsWith("image/") ? generatedImage : undefined;
};

export const generateOrEditImage = async ({
  apiKey,
  baseUrl,
  messages,
  model,
  signal,
  userId,
}: {
  apiKey: string;
  baseUrl?: string;
  messages: ChatMessage[];
  model: string;
  signal: AbortSignal;
  userId: string;
}): Promise<GeneratedImageState> => {
  const latestPrompt = [...messages]
    .reverse()
    .find((message) => message.role === "user")
    ?.content.trim();
  if (!latestPrompt) throw new Error("请描述你想生成或修改的图片");

  const sourceImage = await findSourceImage(messages, userId);
  let response: Response;

  if (sourceImage) {
    const bytes = await getStoredFileBytes(sourceImage);
    const imageBody = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(imageBody).set(bytes);
    const form = new FormData();
    form.append(
      "image",
      new Blob([imageBody], { type: sourceImage.contentType }),
      sourceImage.originalName,
    );
    form.append("model", model);
    form.append("prompt", latestPrompt);
    response = await fetchWithDevelopmentProxy(getOpenAIImageEndpoint(baseUrl, "edits"), {
      body: form,
      headers: { Authorization: `Bearer ${apiKey}` },
      method: "POST",
      signal,
    });
  } else {
    response = await fetchWithDevelopmentProxy(getOpenAIImageEndpoint(baseUrl, "generations"), {
      body: JSON.stringify({ model, n: 1, prompt: latestPrompt }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal,
    });
  }

  if (!response.ok) {
    const detail = await getProviderError(response);
    throw new Error(detail ? `图片生成服务返回错误：${detail}` : "图片生成服务请求失败");
  }

  const payload = (await response.json()) as ImageApiPayload;
  const item = payload.data?.[0];
  if (!item) throw new Error("图片服务未返回生成结果");
  const bytes = await readGeneratedBytes(item, signal);
  const format = detectGeneratedImageFormat(bytes);
  const file = await saveGeneratedFile({
    bytes,
    contentType: format.contentType,
    extension: format.extension,
    fallbackName: "AI 生成图片",
    filename: `AI 生成图片-${Date.now()}${format.extension}`,
    userId,
  });

  return {
    file: {
      contentType: file.contentType,
      id: file.id,
      kind: "attachment",
      name: file.name,
      size: file.size,
    },
    prompt: latestPrompt,
    revisedPrompt: item.revised_prompt,
  };
};
