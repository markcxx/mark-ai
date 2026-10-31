import type { Metadata } from "next";
import { ModelRankings } from "@/components/rankings/ModelRankings";
import { readRankingCatalog } from "@/lib/server/model-catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "模型排名 · MarkAI" };

export default async function RankingsPage() {
  const catalog = await readRankingCatalog();
  const updatedAt = catalog.evaluationsUpdatedAt;
  // Send only public evaluation data; the much larger specifications and
  // derived radar percentiles do not belong in the leaderboard payload.
  const models = catalog.evaluations.map(
    ({
      id,
      slug,
      name,
      intelligence,
      coding,
      agentic,
      capabilities,
      outputTokensPerSecond,
      timeToFirstTokenSeconds,
      pricing,
    }) => ({
      id,
      slug,
      name,
      intelligence,
      coding,
      agentic,
      capabilities,
      outputTokensPerSecond,
      timeToFirstTokenSeconds,
      pricing,
    }),
  );
  return (
    <ModelRankings
      models={models}
      updatedAt={updatedAt}
      indexVersion={catalog.indexVersion}
      stale={
        !updatedAt ||
        !Number.isFinite(Date.parse(updatedAt)) ||
        Date.now() - Date.parse(updatedAt) > 86_400_000
      }
    />
  );
}
