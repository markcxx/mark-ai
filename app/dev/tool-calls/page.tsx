import { notFound } from "next/navigation";

import { ToolCallsPreview } from "./ToolCallsPreview";

export const dynamic = "force-dynamic";

export default async function ToolCallsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ embedded?: string; scenario?: string; theme?: string; view?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  return (
    <ToolCallsPreview
      embedded={params.embedded === "1"}
      initialScenario={params.scenario}
      initialTheme={params.theme}
      initialView={params.view}
    />
  );
}
