import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeAdminApi } from "@/lib/admin/api";
import { getPublicConfiguredModels, getProviderDisplayName } from "@/lib/models";
import { getDb } from "@/lib/db";
import { modelPresentations, adminAuditLogs } from "@/lib/db/schema";
import { readModelPresentations } from "@/lib/model-presentation-server";
import {
  DEFAULT_MODEL_PRESENTATION,
  isNewModel,
  parseModelPresentation,
} from "@/lib/model-presentation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { response } = await authorizeAdminApi(request);
  if (response) return response;
  try {
    const entries = await readModelPresentations();
    const models = getPublicConfiguredModels().map((model) => {
      const entry = entries.find(
        (item) => item.provider === model.provider && item.modelId === model.id,
      );
      return {
        ...model,
        providerName: getProviderDisplayName(model.provider),
        presentation: entry
          ? {
              displayName: entry.displayName,
              description: entry.description,
              isNew: entry.isNew,
              newUntil: entry.newUntil,
              sortOrder: entry.sortOrder,
              newRevision: entry.newRevision,
            }
          : DEFAULT_MODEL_PRESENTATION,
      };
    });
    return NextResponse.json({ models }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin models load failed:", error);
    return NextResponse.json({ error: "模型配置加载失败，请稍后重试" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response) return response;
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([new URL(request.url).origin]);
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) allowedOrigins.add(new URL(appUrl).origin);
  if (origin && !allowedOrigins.has(origin)) {
    return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const config = parseModelPresentation(body?.presentation);
  if (!config || typeof body?.id !== "string" || typeof body?.provider !== "string") {
    return NextResponse.json(
      { error: "请检查模型名称、介绍、排序和结束时间是否有效" },
      { status: 400 },
    );
  }
  if (!getPublicConfiguredModels().some((m) => m.provider === body.provider && m.id === body.id)) {
    return NextResponse.json(
      { error: "该站点模型已移除或尚未配置，请刷新模型列表" },
      { status: 404 },
    );
  }
  if (config.isNew && config.newUntil && Date.parse(config.newUntil) <= Date.now()) {
    return NextResponse.json(
      { error: "上新结束时间必须晚于当前时间，或选择手动关闭" },
      { status: 400 },
    );
  }
  try {
    const current = (await readModelPresentations()).find(
      (m) => m.provider === body.provider && m.modelId === body.id,
    );
    const newRevision =
      config.isNew && !isNewModel(current) ? randomUUID() : (current?.newRevision ?? "");
    const values = {
      provider: body.provider,
      modelId: body.id,
      ...config,
      newRevision,
      newUntil: config.newUntil ? new Date(config.newUntil) : null,
      updatedAt: new Date(),
    };
    const db = getDb();
    await db.batch([
      db
        .insert(modelPresentations)
        .values(values)
        .onConflictDoUpdate({
          target: [modelPresentations.provider, modelPresentations.modelId],
          set: values,
        }),
      db.insert(adminAuditLogs).values({
        id: randomUUID(),
        actorUserId: admin.id,
        action: "model.presentation.update",
        targetType: "model",
        targetId: JSON.stringify([body.provider, body.id]),
        metadata: { ...config, newRevision },
      }),
    ]);
    return NextResponse.json({ presentation: { ...config, newRevision } });
  } catch (error) {
    console.error("Admin model update failed:", error);
    return NextResponse.json({ error: "模型配置保存失败，请稍后重试" }, { status: 500 });
  }
}
