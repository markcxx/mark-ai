import { NextResponse } from "next/server";
import { latestAndroidRelease } from "@/lib/mobile/android-update";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const release = await latestAndroidRelease();
    return NextResponse.json({ update: release?.update ?? null }, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json({ error: "暂时无法检查更新，请稍后重试" }, { status: 503 });
  }
}
