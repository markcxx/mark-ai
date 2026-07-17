import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest, enforceRateLimit } from "@/lib/api/security";
import { searchTavily } from "@/lib/search/tavily";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorizeApiRequest(req);
    if (!authorization.authorized) return authorization.response;
    const limited = enforceRateLimit({ key: authorization.key, limit: 30, scope: "search" });
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query || query.length > 500) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const data = await searchTavily({
      maxResults: body.maxResults,
      query,
      searchDepth: body.searchDepth,
      signal: req.signal,
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({ error: "Search aborted" }, { status: 499 });
    }

    const status =
      error instanceof Error && "status" in error
        ? Number((error as Error & { status?: number }).status) || 500
        : 500;
    const detail =
      error instanceof Error && "detail" in error
        ? (error as Error & { detail?: string }).detail
        : undefined;
    const message = error instanceof Error ? error.message : "Failed to search with Tavily";

    if (status >= 500) console.error("Tavily search error:", error);

    return NextResponse.json({ detail, error: message }, { status });
  }
}
