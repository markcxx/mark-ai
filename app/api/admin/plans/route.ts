import { randomUUID } from "node:crypto";
import { isAllowedOrigin } from "@/lib/app-url";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { authorizeAdminApi } from "@/lib/admin/api";
import { getDb } from "@/lib/db";
import { membershipPlans } from "@/lib/db/schema";
import { parsePlans } from "@/lib/plans";
import { readPlans } from "@/lib/server/plans";
import { writeAdminAudit } from "@/lib/admin/auth";
export async function GET(request: Request) {
  const { response } = await authorizeAdminApi(request);
  if (response) return response;
  return NextResponse.json(await readPlans(), { headers: { "Cache-Control": "no-store" } });
}
export async function PUT(request: Request) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response) return response;
  if (!isAllowedOrigin(request))
    return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const config = parsePlans(body?.config);
  if (!config || typeof body?.revision !== "string")
    return NextResponse.json({ error: "请检查价格、额度、倍数、邮箱和模型配置" }, { status: 400 });
  const values = { config, revision: randomUUID(), updatedAt: new Date() };
  const db = getDb();
  const rows = body.revision
    ? await db
        .update(membershipPlans)
        .set(values)
        .where(and(eq(membershipPlans.id, "current"), eq(membershipPlans.revision, body.revision)))
        .returning()
    : await db
        .insert(membershipPlans)
        .values({ id: "current", ...values })
        .onConflictDoNothing()
        .returning();
  if (!rows.length)
    return NextResponse.json({ error: "配置已被其他管理员修改，请刷新后重试" }, { status: 409 });
  await writeAdminAudit({
    actorUserId: admin.id,
    action: "membership.plans.update",
    targetType: "plans",
    targetId: "current",
    request,
  });
  return NextResponse.json({ config, revision: values.revision });
}

export async function PATCH(request: Request) {
  const { response } = await authorizeAdminApi(request);
  if (response) return response;
  const body = await request.json().catch(() => null);
  const { config, revision } = await readPlans();
  const validOverride = (value: unknown) =>
    value === null ||
    (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 1e9);
  if (body?.modelKey) {
    const m = config.models.find((m) => m.key === body.modelKey);
    if (!m) return NextResponse.json({ error: "模型已移除，请刷新" }, { status: 404 });
    if (body.freeAccess !== undefined && typeof body.freeAccess !== "boolean")
      return NextResponse.json({ error: "免费开放设置无效" }, { status: 400 });
    if (body.creditsOverride !== undefined && !validOverride(body.creditsOverride))
      return NextResponse.json({ error: "单次对话 credits 需为非负整数" }, { status: 400 });
    if (body.freeAccess !== undefined) m.freeAccess = body.freeAccess;
    if (body.creditsOverride !== undefined) m.creditsOverride = body.creditsOverride;
    const prices = body.prices;
    if (prices) {
      if (
        ![prices.input, prices.output].every(
          (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1000000,
        ) ||
        prices.currency !== m.currency ||
        prices.unit !== m.unit
      ) {
        return NextResponse.json(
          { error: "请输入有效的输入、输出价格（0～1000000），币种和单位须与当前报价一致" },
          { status: 400 },
        );
      }
      if (
        body.expectedPrices &&
        (body.expectedPrices.input !== m.input || body.expectedPrices.output !== m.output)
      ) {
        return NextResponse.json(
          { error: "此模型价格已被修改，请重新加载后编辑" },
          { status: 409 },
        );
      }
      m.input = prices.input;
      m.output = prices.output;
      m.priceOverride = {
        input: prices.input,
        output: prices.output,
        currency: m.currency,
        unit: m.unit,
      };
    }
  } else if (body?.tiers && Array.isArray(body.tiers)) {
    config.tiers = config.tiers.map((t) => ({
      ...t,
      price: body.tiers.find((v: { id: string } | null) => v?.id === t.id)?.price,
      multiplier: body.tiers.find((v: { id: string } | null) => v?.id === t.id)?.multiplier,
    }));
    config.contactEmail = body.contactEmail;
    if (body.credits && typeof body.credits === "object") {
      const { baseCredits, creditsPerYuan, freeMessages, usdRate } = body.credits;
      Object.assign(config, { baseCredits, creditsPerYuan, freeMessages, usdRate });
    }
  } else return NextResponse.json({ error: "配置无效" }, { status: 400 });
  return PUT(
    new Request(request.url, {
      method: "PUT",
      headers: request.headers,
      body: JSON.stringify({ config, revision }),
    }),
  );
}
