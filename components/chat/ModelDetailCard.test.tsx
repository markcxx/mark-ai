import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import snapshot from "../../data/model-catalog.json";
import { resolveCatalogMetadata, type ModelCatalog } from "@/lib/model-catalog";
import { ModelDetailCard } from "./ModelDetailCard";

it("renders sourced radar, cache read/write prices and raw measurements", () => {
  const model = { id: "gpt-6.1-sol", provider: "proxy" };
  const html = renderToStaticMarkup(
    <ModelDetailCard
      model={{ ...model, metadata: resolveCatalogMetadata(model, snapshot as ModelCatalog) }}
    />,
  );
  for (const text of [
    "经济性",
    "缓存命中",
    "缓存写入",
    "$0.1",
    "$2.5",
    "原始指标",
    "百分位",
    "Artificial Analysis",
    "Max",
    "tokens/s",
  ])
    expect(html).toContain(text);
  expect(html).not.toContain("NaN");
  expect(html).toContain("工程");
  expect(html).toContain("战略运营");
  expect(html).not.toContain("Agentic 暂无");
  expect(html).not.toContain("编码 暂无");
  expect(html).toContain("财务会计指数");
  expect(html).not.toContain("非当前线路报价");
});

it("renders all five axes when the source has coding and Agentic measurements", () => {
  const metadata = resolveCatalogMetadata(
    { id: "deepseek-v4-flash", provider: "proxy" },
    snapshot as ModelCatalog,
  );
  expect(metadata?.ratings?.coding).toBeDefined();
  expect(metadata?.ratings?.agentic).toBeDefined();
  const html = renderToStaticMarkup(
    <ModelDetailCard model={{ id: "deepseek-v4-flash", provider: "proxy", metadata }} />,
  );
  expect(html).toContain("编码");
  expect(html).toContain("Agentic");
});

it("does not invent a radar or zero prices for missing measurements", () => {
  const html = renderToStaticMarkup(
    <ModelDetailCard model={{ id: "unknown", provider: "proxy" }} />,
  );
  expect(html).not.toContain("<svg");
  expect(html).not.toContain("$0");
  expect(html).toContain("暂未收录");
});

it("shows missing cache write prices without inventing a zero", () => {
  const model = { id: "deepseek-v4-pro-0813", provider: "proxy" };
  const html = renderToStaticMarkup(
    <ModelDetailCard
      model={{ ...model, metadata: resolveCatalogMetadata(model, snapshot as ModelCatalog) }}
    />,
  );
  expect(html).toContain("暂无报价");
  expect(html).not.toContain("NaN");
});
