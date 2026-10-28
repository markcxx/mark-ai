import { expect, it } from "vitest";
import { SETTINGS_SEARCH, SETTINGS_SECTION_IDS, SETTINGS_SECTIONS } from "./settings-sections";
it("excludes deferred settings categories and keeps a unique navigation destination", () => {
  expect(SETTINGS_SECTION_IDS.size).toBe(SETTINGS_SECTIONS.length);
  for (const id of [
    "messenger",
    "devices",
    "environments",
    "notification",
    "labels",
    "memory",
    "connector",
    "creds",
  ])
    expect(SETTINGS_SECTION_IDS.has(id)).toBe(false);
});
it("finds specific capabilities by keywords without introducing excluded pages", () => {
  expect(SETTINGS_SEARCH("翻译").map((item) => item.id)).toEqual(["service-model"]);
  expect(SETTINGS_SEARCH("API Key").map((item) => item.id)).toEqual(["apikey"]);
  expect(SETTINGS_SEARCH("不存在的设置")).toEqual([]);
});
