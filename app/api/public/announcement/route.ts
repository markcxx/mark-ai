import { NextResponse } from "next/server";
import { readAnnouncement } from "@/lib/announcement";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const announcement = process.env.DATABASE_URL ? await readAnnouncement() : null;
    return NextResponse.json({ announcement: announcement?.enabled ? announcement : null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "公告暂时无法加载" }, { status: 503 });
  }
}
