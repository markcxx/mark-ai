import { NextResponse } from "next/server";

import { getCurrentStorageOwnerId } from "@/lib/auth-helpers";
import { deleteStoredFile, getStoredFile } from "@/lib/storage/file-storage";

export async function DELETE(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  const userId = await getCurrentStorageOwnerId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { fileId } = await context.params;
  const file = await getStoredFile(fileId, userId);
  if (!file) return NextResponse.json({ ok: true });
  await deleteStoredFile(file);
  return NextResponse.json({ ok: true });
}
