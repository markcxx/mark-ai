import { fetchWithDevelopmentProxy } from "@/lib/server/development-proxy";

const DEFAULT_TTS_BASE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const DEFAULT_TTS_MODEL = "qwen3-tts-flash";
const DEFAULT_TTS_VOICE = "Cherry";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

type SpeechConfig = {
  apiKey: string;
  baseUrl: string;
  languageType: string;
  model: string;
  provider: string;
  voice: string;
};

type SpeechAudio = {
  bytes: ArrayBuffer;
  contentType: string;
};

type SpeechEnvironment = Record<string, string | undefined>;

const requireHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    // Fall through to the actionable configuration error below.
  }
  throw new Error("MARKAI_TTS_BASE_URL 必须是完整的 HTTP(S) 接口地址");
};

export const resolveSpeechConfig = (env: SpeechEnvironment = process.env): SpeechConfig => {
  const provider = env.MARKAI_TTS_PROVIDER?.trim().toLowerCase();
  if (!provider) throw new Error("未配置 MARKAI_TTS_PROVIDER");

  const apiKey = env.MARKAI_TTS_API_KEY?.trim();
  if (!apiKey) throw new Error("未配置 MARKAI_TTS_API_KEY");

  return {
    apiKey,
    baseUrl: requireHttpUrl(env.MARKAI_TTS_BASE_URL?.trim() || DEFAULT_TTS_BASE_URL),
    languageType: env.MARKAI_TTS_LANGUAGE_TYPE?.trim() || "Auto",
    model: env.MARKAI_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL,
    provider,
    voice: env.MARKAI_TTS_VOICE?.trim() || DEFAULT_TTS_VOICE,
  };
};

const decodeBase64Audio = (data: string): SpeechAudio => {
  const match = data.match(/^data:([^;,]+);base64,([\s\S]*)$/);
  const contentType = match?.[1] || "audio/wav";
  const buffer = Buffer.from(match?.[2] || data, "base64");
  if (!buffer.length) throw new Error("语音合成服务返回了空音频");
  if (buffer.length > MAX_AUDIO_BYTES) throw new Error("合成音频过大，请缩短朗读内容");
  return { bytes: Uint8Array.from(buffer).buffer, contentType };
};

const downloadAudio = async (url: string, signal?: AbortSignal): Promise<SpeechAudio> => {
  const parsedUrl = requireHttpUrl(url);
  const response = await fetchWithDevelopmentProxy(parsedUrl, { signal });
  if (!response.ok) throw new Error(`下载合成音频失败 (${response.status})`);

  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_AUDIO_BYTES) throw new Error("合成音频过大，请缩短朗读内容");

  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) throw new Error("语音合成服务返回了空音频");
  if (bytes.byteLength > MAX_AUDIO_BYTES) throw new Error("合成音频过大，请缩短朗读内容");
  return {
    bytes,
    contentType: response.headers.get("content-type")?.split(";")[0] || "audio/wav",
  };
};

export const generateSpeechAudio = async ({
  signal,
  text,
  voice,
}: {
  signal?: AbortSignal;
  text: string;
  voice?: string;
}): Promise<SpeechAudio> => {
  const config = resolveSpeechConfig();
  const response = await fetchWithDevelopmentProxy(config.baseUrl, {
    body: JSON.stringify({
      input: {
        language_type: config.languageType,
        text,
        voice: voice || config.voice,
      },
      model: config.model,
    }),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.message === "string" ? `：${data.message}` : "";
    throw new Error(`语音合成服务请求失败 (${response.status})${detail}`);
  }

  const audio = data?.output?.audio;
  if (typeof audio?.data === "string" && audio.data.trim()) {
    return decodeBase64Audio(audio.data.trim());
  }
  if (typeof audio?.url === "string" && audio.url.trim()) {
    return downloadAudio(audio.url.trim(), signal);
  }
  throw new Error("语音合成服务没有返回音频");
};
