import type { ModelRuntime } from "./models";

export type ModelProviderTemplate = {
  defaultBaseUrl: string;
  defaultModels: string[];
  description: string;
  id: string;
  name: string;
  runtime: ModelRuntime;
};

export const MODEL_PROVIDER_TEMPLATES: ModelProviderTemplate[] = [
  {
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    defaultModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
    description: "Google Gemini 原生接口",
    id: "gemini",
    name: "Google Gemini",
    runtime: "gemini",
  },
  {
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModels: ["gpt-4.1", "gpt-4.1-mini"],
    description: "OpenAI 官方接口",
    id: "openai",
    name: "OpenAI",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModels: ["deepseek-chat", "deepseek-reasoner"],
    description: "DeepSeek 官方接口",
    id: "deepseek",
    name: "DeepSeek",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.minimaxi.com/v1",
    defaultModels: ["MiniMax-M3"],
    description: "MiniMax 开放平台 OpenAI 兼容接口",
    id: "minimax",
    name: "MiniMax",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultModels: ["kimi-k2.5", "moonshot-v1-8k"],
    description: "Moonshot AI / Kimi 开放平台",
    id: "moonshot",
    name: "Moonshot AI",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModels: ["qwen-plus", "qwen-max"],
    description: "阿里云百炼 OpenAI 兼容接口",
    id: "bailian",
    name: "阿里云百炼",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModels: ["glm-4-plus", "glm-4-flash"],
    description: "智谱 BigModel 开放平台",
    id: "zhipu",
    name: "智谱 AI",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModels: [],
    description: "聚合多家模型的 OpenAI 兼容网关",
    id: "openrouter",
    name: "OpenRouter",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.siliconflow.cn/v1",
    defaultModels: [],
    description: "硅基流动 SiliconCloud",
    id: "siliconflow",
    name: "硅基流动",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModels: [],
    description: "火山引擎方舟 OpenAI 兼容接口",
    id: "volcengine",
    name: "火山方舟",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModels: [],
    description: "GroqCloud 高速推理接口",
    id: "groq",
    name: "Groq",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModels: [],
    description: "Mistral AI 官方接口",
    id: "mistral",
    name: "Mistral AI",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.together.xyz/v1",
    defaultModels: [],
    description: "Together AI 模型平台",
    id: "together",
    name: "Together AI",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.x.ai/v1",
    defaultModels: [],
    description: "xAI 官方接口",
    id: "xai",
    name: "xAI",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://router.huggingface.co/v1",
    defaultModels: [],
    description: "HuggingFace Inference Providers",
    id: "huggingface",
    name: "HuggingFace",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://cloud.infini-ai.com/maas/v1",
    defaultModels: [],
    description: "无问芯穹 MaaS 平台",
    id: "infiniai",
    name: "无问芯穹",
    runtime: "openai-compatible",
  },
];

export const getModelProviderTemplate = (provider: string) =>
  MODEL_PROVIDER_TEMPLATES.find((item) => item.id === provider);
