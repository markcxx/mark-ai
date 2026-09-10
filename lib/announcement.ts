import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { siteAnnouncements } from "@/lib/db/schema";
import { DEFAULT_ANNOUNCEMENT } from "./announcement-config";

export const ANNOUNCEMENT_LIMIT = 1000;

export function parseAnnouncement(body: unknown): string | null {
  if (
    !body ||
    typeof body !== "object" ||
    !("content" in body) ||
    typeof body.content !== "string" ||
    body.content.length > ANNOUNCEMENT_LIMIT
  )
    return null;
  return body.content.trim();
}

export async function readAnnouncement() {
  const [announcement] = await getDb()
    .select()
    .from(siteAnnouncements)
    .where(eq(siteAnnouncements.id, "current"))
    .limit(1);
  return announcement ?? { ...DEFAULT_ANNOUNCEMENT, revision: "", updatedAt: null };
}
