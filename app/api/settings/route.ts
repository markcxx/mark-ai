import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { getDb } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { DEFAULT_SETTINGS, mergeSettings } from "@/lib/settings";
import { getSettingsOrDefaults } from "@/lib/user-settings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return authorization.response;
  const settings = await getSettingsOrDefaults(authorization.userId);
  return NextResponse.json({
    cloudPersistence: Boolean(authorization.userId),
    settings,
  });
}

export async function PATCH(req: NextRequest) {
  const authorization = await authorizeApiRequest(req);
  if (!authorization.authorized) return authorization.response;
  const limited = enforceRateLimit({
    key: authorization.key,
    limit: 120,
    scope: "settings-write",
  });
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
  }

  const current = await getSettingsOrDefaults(authorization.userId);
  const settings = body.reset === true ? DEFAULT_SETTINGS : mergeSettings(current, body);

  if (authorization.userId) {
    await getDb()
      .insert(userSettings)
      .values({
        general: settings.general,
        id: `settings-${authorization.userId}`,
        languageModel: settings.languageModel,
        userId: authorization.userId,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          general: settings.general,
          languageModel: settings.languageModel,
          updatedAt: new Date(),
        },
      });
  }

  return NextResponse.json({ ok: true, settings });
}
