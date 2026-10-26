import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), write: vi.fn() }));
vi.mock("./development-proxy", () => ({ fetchWithDevelopmentProxy: mocks.fetch }));
vi.mock("node:fs/promises", () => ({
  readFile: async () => {
    throw new Error("no cache");
  },
  mkdir: vi.fn(),
  writeFile: mocks.write,
  rename: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("ARTIFICIAL_ANALYSIS_API_KEY", "test-only-credential");
});

const row = (slug: string) => ({
  id: slug,
  slug,
  name: slug,
  pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 2 },
});
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

it("fetches all AA pages, shares a concurrent refresh and never persists the credential", async () => {
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.includes("models.dev"))
      return response({ openai: { models: { demo: { id: "demo", name: "Demo" } } } });
    const page = Number(new URL(url).searchParams.get("page"));
    return response({
      data: [row(`demo-${page}`)],
      intelligence_index_version: 4.3,
      pagination: { has_more: page < 2 },
    });
  });
  const { refreshModelCatalog, withModelCatalog } = await import("./model-catalog");
  const [first, second] = await Promise.all([refreshModelCatalog(), refreshModelCatalog()]);
  expect(first).toBe(second);
  expect(first.evaluations.map((entry) => entry.slug)).toEqual(["demo-1", "demo-2"]);
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  expect(mocks.write.mock.calls[0][1]).not.toContain("test-only-credential");
  expect(
    JSON.stringify(await withModelCatalog([{ id: "demo-1", provider: "proxy" }])),
  ).not.toContain("test-only-credential");
  expect(
    mocks.fetch.mock.calls.find(([url]) => url.includes("artificialanalysis"))?.[1].headers,
  ).toEqual({ "x-api-key": "test-only-credential" });
});

it("retains the complete previous AA snapshot when a later page fails", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.fetch.mockImplementation(async (url: string) => {
    if (url.includes("models.dev"))
      return response({ openai: { models: { demo: { id: "demo", name: "Demo" } } } });
    if (url.endsWith("page=2")) return new Response("untrusted error", { status: 429 });
    return response({
      data: [row("partial")],
      intelligence_index_version: 4.3,
      pagination: { has_more: true },
    });
  });
  try {
    const { readModelCatalog, refreshModelCatalog } = await import("./model-catalog");
    const before = await readModelCatalog();
    const after = await refreshModelCatalog();
    expect(after.evaluations).toEqual(before.evaluations);
    expect(after.evaluationsUpdatedAt).toBe(before.evaluationsUpdatedAt);
    expect(after.evaluations.some((entry) => entry.slug === "partial")).toBe(false);
  } finally {
    warn.mockRestore();
  }
});

it("serves bundled data without an AA key and never sends an unauthenticated AA request", async () => {
  vi.stubEnv("ARTIFICIAL_ANALYSIS_API_KEY", "");
  mocks.fetch.mockResolvedValue(
    response({ openai: { models: { demo: { id: "demo", name: "Demo" } } } }),
  );
  const { refreshModelCatalog } = await import("./model-catalog");
  const after = await refreshModelCatalog();
  expect(after.evaluations.length).toBeGreaterThan(0);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(mocks.fetch.mock.calls[0][0]).toBe("https://models.dev/api.json");
});
