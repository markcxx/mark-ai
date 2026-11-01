import { NextResponse } from "next/server";
import { isAllowedOrigin } from "@/lib/app-url";
import { eq } from "drizzle-orm";
import { authorizeAdminApi } from "@/lib/admin/api";
import { getDb } from "@/lib/db";
import { users, userMemberships } from "@/lib/db/schema";
import { PLAN_IDS } from "@/lib/plans";
import { readMembership } from "@/lib/server/plans";
import { writeAdminAudit } from "@/lib/admin/auth";
export async function GET(request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { response } = await authorizeAdminApi(request);
  if (response) return response;
  return NextResponse.json(await readMembership((await ctx.params).userId));
}
export async function PUT(request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response) return response;
  if (!isAllowedOrigin(request))
    return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  const { userId } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (
    !body ||
    !PLAN_IDS.includes(body.tier) ||
    (body.tier !== "free" &&
      body.tier !== "lifetime" &&
      (typeof body.expiresAt !== "string" ||
        !Number.isFinite(Date.parse(body.expiresAt)) ||
        Date.parse(body.expiresAt) <= Date.now()))
  )
    return NextResponse.json({ error: "请选择会员等级及有效的到期时间" }, { status: 400 });
  const db = getDb();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  const values = {
    userId,
    tier: body.tier,
    expiresAt: ["free", "lifetime"].includes(body.tier) ? null : new Date(body.expiresAt),
    updatedAt: new Date(),
  };
  await db
    .insert(userMemberships)
    .values(values)
    .onConflictDoUpdate({ target: userMemberships.userId, set: values });
  await writeAdminAudit({
    actorUserId: admin.id,
    action: "membership.assign",
    targetType: "user",
    targetId: userId,
    metadata: { tier: values.tier, expiresAt: values.expiresAt },
    request,
  });
  return NextResponse.json(await readMembership(userId));
}
