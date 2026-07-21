import { and, count, eq, gt, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authorizeAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { getDb } from "@/lib/db";
import { accounts, authSessions, storageFiles, users, waitlistEntries } from "@/lib/db/schema";
import { isBootstrapAdminEmail, normalizeEmail } from "@/lib/registration";
import { deleteStoredFile, toStoredFileRecord } from "@/lib/storage/file-storage";

const findUser = async (userId: string) => {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  return user;
};

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { userId } = await context.params;
  const user = await findUser(userId);
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  const db = getDb();
  const [linkedAccounts, sessions] = await Promise.all([
    db
      .select({ createdAt: accounts.createdAt, providerId: accounts.providerId })
      .from(accounts)
      .where(eq(accounts.userId, userId)),
    db
      .select({
        createdAt: authSessions.createdAt,
        expiresAt: authSessions.expiresAt,
        id: authSessions.id,
        ipAddress: authSessions.ipAddress,
        updatedAt: authSessions.updatedAt,
        userAgent: authSessions.userAgent,
      })
      .from(authSessions)
      .where(and(eq(authSessions.userId, userId), gt(authSessions.expiresAt, new Date()))),
  ]);
  await writeAdminAudit({
    action: "user.view",
    actorUserId: admin.id,
    request,
    targetId: userId,
    targetType: "user",
  });
  return NextResponse.json({ accounts: linkedAccounts, loginSessions: sessions, user });
}

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { userId } = await context.params;
  const current = await findUser(userId);
  if (!current) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.fullName === "string")
    updates.fullName = body.fullName.trim().slice(0, 60) || null;
  if (typeof body.username === "string")
    updates.username = body.username.trim().slice(0, 40) || null;
  if (body.age !== undefined) {
    const age = Number(body.age);
    if (body.age !== null && (!Number.isInteger(age) || age < 6 || age > 120)) {
      return NextResponse.json({ error: "年龄必须在 6～120 之间" }, { status: 400 });
    }
    updates.age = body.age === null ? null : age;
  }
  if (typeof body.email === "string") {
    const email = normalizeEmail(body.email);
    if (!email.includes("@")) return NextResponse.json({ error: "邮箱格式无效" }, { status: 400 });
    if (email !== current.email) {
      updates.email = email;
      updates.emailVerified = false;
    }
  }

  if (typeof body.role === "string" && ["admin", "user"].includes(body.role)) {
    if (userId === admin.id && body.role !== "admin") {
      return NextResponse.json({ error: "不能取消自己的管理员权限" }, { status: 400 });
    }
    if (isBootstrapAdminEmail(current.email) && body.role !== "admin") {
      return NextResponse.json({ error: "不能降级环境变量指定的管理员" }, { status: 400 });
    }
    if (current.role === "admin" && body.role !== "admin") {
      const [otherAdmins] = await getDb()
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.role, "admin"), ne(users.id, userId)));
      if (!otherAdmins.value) {
        return NextResponse.json({ error: "不能降级最后一个管理员" }, { status: 400 });
      }
    }
    updates.role = body.role;
  }

  if (typeof body.banned === "boolean") {
    if (userId === admin.id && body.banned) {
      return NextResponse.json({ error: "不能封禁自己的账户" }, { status: 400 });
    }
    if (isBootstrapAdminEmail(current.email) && body.banned) {
      return NextResponse.json({ error: "不能封禁环境变量指定的管理员" }, { status: 400 });
    }
    updates.banned = body.banned;
    updates.banReason = body.banned
      ? typeof body.banReason === "string"
        ? body.banReason.trim().slice(0, 300)
        : null
      : null;
    if (body.banned && typeof body.banExpires === "string" && body.banExpires) {
      const banExpires = new Date(body.banExpires);
      if (!Number.isFinite(banExpires.getTime()) || banExpires <= new Date()) {
        return NextResponse.json({ error: "封禁到期时间必须晚于当前时间" }, { status: 400 });
      }
      updates.banExpires = banExpires;
    } else {
      updates.banExpires = null;
    }
  }

  await getDb().update(users).set(updates).where(eq(users.id, userId));
  if (body.banned === true) {
    await getDb().delete(authSessions).where(eq(authSessions.userId, userId));
  }
  await writeAdminAudit({
    action: "user.update",
    actorUserId: admin.id,
    metadata: { fields: Object.keys(updates).filter((key) => key !== "updatedAt") },
    request,
    targetId: userId,
    targetType: "user",
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { userId } = await context.params;
  if (userId === admin.id) return NextResponse.json({ error: "不能删除自己" }, { status: 400 });
  const user = await findUser(userId);
  if (!user) return NextResponse.json({ ok: true });
  if (isBootstrapAdminEmail(user.email)) {
    return NextResponse.json({ error: "不能删除环境变量指定的管理员" }, { status: 400 });
  }
  const files = await getDb().select().from(storageFiles).where(eq(storageFiles.userId, userId));
  for (const file of files) await deleteStoredFile(toStoredFileRecord(file));
  const relatedWaitlist = await getDb()
    .select({ id: waitlistEntries.id })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.registeredUserId, userId));
  if (relatedWaitlist.length) {
    await getDb().delete(waitlistEntries).where(eq(waitlistEntries.registeredUserId, userId));
  }
  await writeAdminAudit({
    action: "user.delete",
    actorUserId: admin.id,
    metadata: {
      email: user.email,
      filesDeleted: files.length,
      waitlistEntriesDeleted: relatedWaitlist.length,
    },
    request,
    targetId: userId,
    targetType: "user",
  });
  await getDb().delete(users).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}
