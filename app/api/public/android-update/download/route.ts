import { NextRequest, NextResponse } from "next/server";
import { downloadAndroidRelease, latestAndroidRelease } from "@/lib/mobile/android-update";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const release = await latestAndroidRelease();
    if (!release || request.nextUrl.searchParams.get("versionCode") !== String(release.update.versionCode)) {
      return NextResponse.json({ error: "版本已变更，请重新检查更新" }, { status: 409 });
    }
    const response = await downloadAndroidRelease(release.assetId, request.signal);
    return new Response(response.body, { headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": String(release.update.size),
      "Content-Disposition": `attachment; filename="MarkAI-${release.update.versionName}.apk"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return NextResponse.json({ error: "下载暂时不可用，请稍后重试" }, { status: 503 });
  }
}
