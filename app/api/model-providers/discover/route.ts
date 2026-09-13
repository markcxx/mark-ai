import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { getDb } from "@/lib/db";
import { userModelProviders } from "@/lib/db/schema";
import { decryptCredential } from "@/lib/credential-crypto";
import { getModelProviderTemplate } from "@/lib/model-provider-registry";
import { getConfiguredModels } from "@/lib/models";
import { discoverProviderModels } from "@/lib/server/provider-model-discovery";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowedOrigins = new Set([new URL(req.url).origin]);
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) allowedOrigins.add(new URL(appUrl).origin);
  if (origin && !allowedOrigins.has(origin))
    return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  const auth = await authorizeApiRequest(req);
  if (!auth.authorized) return auth.response;
  const limited = enforceRateLimit({ key: auth.key, limit: 10, scope: "model-discovery" });
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  if (typeof body?.provider !== "string" || body.provider.length > 60)
    return NextResponse.json({ error: "提供商 ID 无效" }, { status: 400 });
  try {
    const template = getModelProviderTemplate(body.provider);
    let config;
    if (body.site === true) {
      config = getConfiguredModels().find((item) => item.provider === body.provider);
    } else {
      if (!auth.userId)
        return NextResponse.json({ error: "请先登录后配置个人提供商" }, { status: 401 });
      const [saved] = await getDb()
        .select()
        .from(userModelProviders)
        .where(
          and(
            eq(userModelProviders.userId, auth.userId),
            eq(userModelProviders.provider, body.provider),
          ),
        )
        .limit(1);
      const baseUrl =
        typeof body.baseUrl === "string" ? body.baseUrl.trim() : template?.defaultBaseUrl;
      if (!baseUrl || baseUrl.length > 500) throw new Error("请填写有效的 API 地址");
      const suppliedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
      if (
        !suppliedKey &&
        saved?.apiKeyEncrypted &&
        saved.baseUrl.replace(/\/+$/, "") !== baseUrl.replace(/\/+$/, "")
      )
        throw new Error("修改 API 地址后，请重新填写密钥再获取模型");
      config = {
        baseUrl,
        apiKey:
          suppliedKey || (saved?.apiKeyEncrypted ? decryptCredential(saved.apiKeyEncrypted) : ""),
        runtime: template?.runtime || saved?.runtime || "openai-compatible",
      };
    }
    if (!config?.apiKey) throw new Error("请先填写 API Key，再获取模型列表");
    const models = await discoverProviderModels(config);
    return NextResponse.json({ models }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && /^[\u4e00-\u9fff]/.test(error.message)
            ? error.message
            : "获取模型失败，请检查配置并稍后重试",
      },
      { status: 400 },
    );
  }
}
