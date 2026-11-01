import { randomUUID } from "node:crypto";
import { isAllowedOrigin } from "@/lib/app-url";
import { NextResponse } from "next/server";
import { authorizeAdminApi } from "@/lib/admin/api";
import { ANNOUNCEMENT_LIMIT, readAnnouncement } from "@/lib/announcement";
import { getAnnouncementScope, parseAnnouncementConfig } from "@/lib/announcement-config";
import { getDb } from "@/lib/db";
import { adminAuditLogs, siteAnnouncements } from "@/lib/db/schema";

export async function GET(request: Request) {
  const { response } = await authorizeAdminApi(request);
  if (response) return response;
  const scope = getAnnouncementScope(request.url);
  if (!scope) return NextResponse.json({ error: "公告位置无效" }, { status: 400 });
  return NextResponse.json({ announcement: await readAnnouncement(scope) });
}

export async function PUT(request: Request) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response) return response;
  const scope = getAnnouncementScope(request.url);
  if (!scope) return NextResponse.json({ error: "公告位置无效" }, { status: 400 });
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "请求来源无效" }, { status: 403 });
  }
  const config = parseAnnouncementConfig(await request.json().catch(() => null));
  if (config === null)
    return NextResponse.json(
      {
        error: `请检查公告（最多 ${ANNOUNCEMENT_LIMIT} 字）、按钮文字（最多 24 字）和跳转地址（站内路径、HTTP/HTTPS 链接或 mailto 邮箱地址）`,
      },
      { status: 400 },
    );
  const values = { id: scope, ...config, revision: randomUUID(), updatedAt: new Date() };
  const db = getDb();
  await db.batch([
    db
      .insert(siteAnnouncements)
      .values(values)
      .onConflictDoUpdate({ target: siteAnnouncements.id, set: values }),
    db.insert(adminAuditLogs).values({
      id: randomUUID(),
      actorUserId: admin.id,
      action: config.enabled && config.content ? "announcement.publish" : "announcement.withdraw",
      targetType: "announcement",
      targetId: scope,
      metadata: {
        revision: values.revision,
        length: config.content.length,
        enabled: config.enabled,
      },
    }),
  ]);
  return NextResponse.json({ announcement: values });
}
