import { NextRequest, NextResponse } from "next/server";

import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { findAvailableModel } from "@/lib/available-models";
import { findConfiguredModel } from "@/lib/models";
import {
  getTranslationLanguageLabel,
  TRANSLATION_LANGUAGES,
} from "@/lib/chat/translation-languages";
import { generateTranslation } from "@/lib/chat/translation";

const MAX_TRANSLATION_CHARS = 50_000;

const resolveEnvironmentTranslationModel = () => {
  const raw = process.env.MARKAI_TRANSLATION_MODEL?.trim();
  if (!raw) return { configured: false as const, model: undefined };

  const separatorIndex = raw.indexOf("/");
  if (separatorIndex <= 0 || separatorIndex === raw.length - 1) {
    return { configured: true as const, error: "MARKAI_TRANSLATION_MODEL 格式无效" };
  }

  const provider = raw.slice(0, separatorIndex).trim().toLowerCase();
  const modelId = raw.slice(separatorIndex + 1).trim();
  const model = findConfiguredModel(modelId, provider);
  if (!model) {
    return {
      configured: true as const,
      error: `MARKAI_TRANSLATION_MODEL 未匹配到已配置模型：${raw}`,
    };
  }
  return { configured: true as const, model };
};

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorizeApiRequest(req);
    if (!authorization.authorized) return authorization.response;
    const limited = enforceRateLimit({ key: authorization.key, limit: 20, scope: "translate" });
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const targetLanguage = typeof body?.targetLanguage === "string" ? body.targetLanguage : "";
    const allowedLanguage = TRANSLATION_LANGUAGES.some(
      (language) => language.value === targetLanguage,
    );

    if (!content || content.length > MAX_TRANSLATION_CHARS || !allowedLanguage) {
      return NextResponse.json({ error: "翻译内容或目标语言无效" }, { status: 400 });
    }

    let model;
    if (body?.useSystemModel === true) {
      const environmentModel = resolveEnvironmentTranslationModel();
      if (environmentModel.configured && !environmentModel.model) {
        return NextResponse.json({ error: environmentModel.error }, { status: 500 });
      }
      model =
        environmentModel.model ||
        (await findAvailableModel(
          body?.fallbackModel,
          body?.fallbackProvider,
          authorization.userId,
        ));
    } else {
      model = await findAvailableModel(body?.model, body?.provider, authorization.userId);
    }
    if (!model) return NextResponse.json({ error: "当前模型不可用" }, { status: 400 });

    const language = getTranslationLanguageLabel(targetLanguage)!;
    const translation = await generateTranslation({ content, language, model });
    return NextResponse.json({ language, translation });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "翻译失败，请稍后重试" },
      { status: 500 },
    );
  }
}
