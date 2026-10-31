import { NextResponse } from "next/server";
import { readAnnouncement } from "@/lib/announcement";

import { getAnnouncementScope } from "@/lib/announcement-config";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const scope = getAnnouncementScope(request.url);
  if (!scope) return NextResponse.json({ error: "公告位置无效" }, { status: 400 });
  try {
    const announcement = process.env.DATABASE_URL ? await readAnnouncement(scope) : null;
    return NextResponse.json({ announcement: announcement?.enabled ? announcement : null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "公告暂时无法加载" }, { status: 503 });
  }
}
