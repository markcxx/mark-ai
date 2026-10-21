import { toAnthropicMessagesEndpoint } from "@/lib/chat/server/anthropic-transport";
import { NextRequest, NextResponse } from "next/server";

import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { findAvailableModel } from "@/lib/available-models";
import { describeGenerationError } from "@/lib/chat/generation-error";
import { runChartTest } from "@/lib/chat/server/chart-test";
import { isImageGenerationModel } from "@/lib/chat/image-models";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 });
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return authorization.response;
  const limited = enforceRateLimit({ key: authorization.key, limit: 6, scope: "chart-test" });
  if (limited) return limited;
  if (Number(req.headers.get("content-length")) > 32_000)
    return NextResponse.json({ error: "测试请求过长" }, { status: 413 });
  const body = await req.json().catch(() => null);
  if (
    typeof body?.prompt !== "string" ||
    !body.prompt.trim() ||
    body.prompt.length > 12_000 ||
    typeof body.model !== "string" ||
    typeof body.provider !== "string"
  )
    return NextResponse.json(
      { error: "请选择输出模型，并填写不超过 12,000 字的测试要求" },
      { status: 400 },
    );
  const model = await findAvailableModel(body.model, body.provider, authorization.userId);
  if (!model || isImageGenerationModel(model.id))
    return NextResponse.json({ error: "所选文字模型不可用" }, { status: 400 });

  const withRoute = (response: Response) => {
    let endpoint =
      model.runtime === "anthropic"
        ? toAnthropicMessagesEndpoint(model.baseUrl)
        : model.baseUrl || "";
    if (model.runtime === "openai-compatible" && !endpoint.endsWith("/chat/completions"))
      endpoint = endpoint.replace(/\/+$/, "") + "/chat/completions";
    try {
      const url = new URL(endpoint);
      endpoint = url.origin + url.pathname;
    } catch {
      endpoint = model.runtime;
    }
    response.headers.set(
      "X-MarkAI-Test-Route",
      encodeURIComponent(JSON.stringify({ provider: model.provider, model: model.id, endpoint })),
    );
    return response;
  };
  try {
    return withRoute(
      await runChartTest({
        model,
        prompt: body.prompt.trim(),
        signal: AbortSignal.any([req.signal, AbortSignal.timeout(180_000)]),
        userId: authorization.userId,
        thinkingEnabled:
          typeof body.thinkingEnabled === "boolean" ? body.thinkingEnabled : undefined,
      }),
    );
  } catch (error) {
    return withRoute(
      NextResponse.json({ error: describeGenerationError(error, [model.apiKey]) }, { status: 502 }),
    );
  }
}
