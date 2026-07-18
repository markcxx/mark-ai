import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authorizeAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { processWaitlistAction, WaitlistActionError } from "@/lib/admin/waitlist-actions";
import { getDb } from "@/lib/db";
import { waitlistEntries } from "@/lib/db/schema";

const actions = ["approve", "reject", "resend", "revoke"] as const;
type WaitlistAction = (typeof actions)[number];

export async function PATCH(request: Request, context: { params: Promise<{ entryId: string }> }) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { entryId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  if (typeof action !== "string" || !actions.includes(action as WaitlistAction)) {
    return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
  }
  try {
    const result = await processWaitlistAction({
      action: action as WaitlistAction,
      actorUserId: admin.id,
      entryId,
      request,
      reviewNote: typeof body.reviewNote === "string" ? body.reviewNote : "",
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WaitlistActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ entryId: string }> }) {
  const { admin, response } = await authorizeAdminApi(request);
  if (response || !admin) return response;
  const { entryId } = await context.params;
  await getDb().delete(waitlistEntries).where(eq(waitlistEntries.id, entryId));
  await writeAdminAudit({
    action: "waitlist.delete",
    actorUserId: admin.id,
    request,
    targetId: entryId,
    targetType: "waitlist",
  });
  return NextResponse.json({ ok: true });
}
