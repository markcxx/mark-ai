import { getDb } from "@/lib/db";
import { modelPresentations } from "@/lib/db/schema";

export async function readModelPresentations() {
  if (!process.env.DATABASE_URL) return [];
  const rows = await getDb().select().from(modelPresentations);
  return rows.map((row) => ({
    ...row,
    newUntil: row.newUntil?.toISOString() ?? null,
  }));
}
