import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const [user] = await getDb()
    .select({
      age: users.age,
      avatar: users.avatar,
      email: users.email,
      fullName: users.fullName,
      profileCompleted: users.profileCompleted,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user
    ? NextResponse.json({ user })
    : NextResponse.json({ error: "用户不存在" }, { status: 404 });
}

export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const db = getDb();
  const [current] = await db
    .select({
      age: users.age,
      fullName: users.fullName,
      profileCompleted: users.profileCompleted,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!current) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const hasName = typeof body?.fullName === "string";
  const hasAge = body?.age !== undefined;
  const fullName = hasName ? body.fullName.trim().slice(0, 40) : current.fullName;
  const age = hasAge ? Number(body.age) : current.age;
  if (hasName && (!fullName || fullName.length < 2)) {
    return NextResponse.json({ error: "昵称至少需要 2 个字符" }, { status: 400 });
  }
  if (hasAge && (!Number.isInteger(age) || Number(age) < 6 || Number(age) > 120)) {
    return NextResponse.json({ error: "请输入 6～120 岁之间的有效年龄" }, { status: 400 });
  }
  if (body?.complete === true && (!fullName || !age)) {
    return NextResponse.json({ error: "请先完成昵称和年龄设置" }, { status: 400 });
  }

  await db
    .update(users)
    .set({
      age,
      fullName,
      profileCompleted: body?.complete === true ? true : current.profileCompleted,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  return NextResponse.json({ ok: true, user: { age, fullName } });
}
