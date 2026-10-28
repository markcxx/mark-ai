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
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModels: [],
    description:
      "Anthropic 专注于可靠、可控的人工智能，Claude 系列可用于写作、编程、分析与复杂任务。支持原生 Messages 接口。",
    id: "anthropic",
    name: "Anthropic",
    runtime: "anthropic",
  },
  {
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    defaultModels: ["gemini-2.5-flash", "gemini-2.5-pro"],
    description:
      "Google 的 Gemini 系列提供文本、图像、音视频理解及长上下文处理能力。通过 Google AI 接口连接模型。",
    id: "gemini",
    name: "Google Gemini",
    runtime: "gemini",
  },
  {
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModels: ["gpt-4.1", "gpt-4.1-mini"],
    description:
      "OpenAI 提供 GPT 系列及推理模型，覆盖对话、编程、多模态理解和工具调用等场景。可在此配置个人 API 服务。",
    id: "openai",
    name: "OpenAI",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.deepseek.com",
    defaultModels: ["deepseek-chat", "deepseek-reasoner"],
    description:
      "DeepSeek 提供通用对话和推理模型，适用于代码、数学与知识问答。使用兼容 OpenAI 的 API 接入。",
    id: "deepseek",
    name: "DeepSeek",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.minimaxi.com/v1",
    defaultModels: ["MiniMax-M3"],
    description: "MiniMax 提供面向对话、推理与智能体任务的模型服务，支持长文本处理和工具调用。",
    id: "minimax",
    name: "MiniMax",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    defaultModels: ["kimi-k2.5", "moonshot-v1-8k"],
    description:
      "月之暗面的 Kimi 系列面向长文本理解、知识问答和智能体任务，可通过 Moonshot 开放平台接入。",
    id: "moonshot",
    name: "Moonshot AI",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModels: ["qwen-plus", "qwen-max"],
    description:
      "阿里云百炼集成通义千问等模型，支持文本生成、多模态理解与工具调用。使用百炼的 OpenAI 兼容接口。",
    id: "bailian",
    name: "阿里云百炼",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModels: ["glm-4-plus", "glm-4-flash"],
    description: "智谱 AI 开放平台提供 GLM 系列模型，覆盖语言理解、推理、代码生成和多模态任务。",
    id: "zhipu",
    name: "智谱 AI",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModels: [],
    description:
      "OpenRouter 将多家厂商的模型汇集到统一 API 中，便于选择和比较模型，并按需切换服务。",
    id: "openrouter",
    name: "OpenRouter",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.siliconflow.cn/v1",
    defaultModels: [],
    description: "硅基流动提供多种开源模型的云端推理服务，覆盖语言、视觉等场景，支持统一接口调用。",
    id: "siliconflow",
    name: "硅基流动",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModels: [],
    description: "火山方舟是火山引擎的大模型服务平台，提供豆包等模型的推理与应用开发能力。",
    id: "volcengine",
    name: "火山方舟",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModels: [],
    description: "GroqCloud 通过专用推理基础设施提供模型服务，适用于重视生成速度的对话与应用场景。",
    id: "groq",
    name: "Groq",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultModels: [],
    description: "Mistral AI 提供通用语言、代码和多模态模型，可用于问答、内容生成及企业应用。",
    id: "mistral",
    name: "Mistral AI",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.together.xyz/v1",
    defaultModels: [],
    description:
      "Together AI 提供开源模型的推理服务，覆盖文本、代码与多模态模型，支持兼容 OpenAI 的调用方式。",
    id: "together",
    name: "Together AI",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://api.x.ai/v1",
    defaultModels: [],
    description: "xAI 提供 Grok 系列模型，面向对话、推理与多模态理解，可通过官方 API 接入。",
    id: "xai",
    name: "xAI",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://router.huggingface.co/v1",
    defaultModels: [],
    description:
      "Hugging Face 汇集开源模型与推理服务，提供统一的 Inference Providers 接口以连接不同模型。",
    id: "huggingface",
    name: "HuggingFace",
    runtime: "openai-compatible",
  },
  {
    defaultBaseUrl: "https://cloud.infini-ai.com/maas/v1",
    defaultModels: [],
    description: "无问芯穹的 MaaS 平台提供模型推理服务，面向通用对话、推理与智能体应用。",
    id: "infiniai",
    name: "无问芯穹",
    runtime: "openai-compatible",
  },
];

export const getModelProviderTemplate = (provider: string) =>
  MODEL_PROVIDER_TEMPLATES.find((item) => item.id === provider);
