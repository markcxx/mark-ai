import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL_PRESENTATION as defaults,
  getNewModels,
  getNewModelToken,
  hasUndismissedModels,
  isNewModel,
  parseModelPresentation,
  withModelPresentations,
} from "./model-presentation";

const now = Date.parse("2026-09-13T12:00:00Z");
const model = (id: string, provider = "site", sortOrder = 0) => ({
  id,
  provider,
  presentation: { ...defaults, isNew: true, sortOrder, newRevision: "launch-1" },
});

describe("model launch metadata", () => {
  it("validates lengths, sorting and dates while preserving literal display text", () => {
    expect(parseModelPresentation({ ...defaults, displayName: " <b>模型</b> " })?.displayName).toBe(
      "<b>模型</b>",
    );
    for (const patch of [
      { displayName: "x".repeat(81) },
      { description: "x".repeat(161) },
      { sortOrder: -1 },
      { sortOrder: 1.2 },
      { sortOrder: 10000 },
      { newUntil: "" },
      { newUntil: 1 },
      { isNew: "true" },
    ]) {
      expect(parseModelPresentation({ ...defaults, ...patch })).toBeNull();
    }
  });
  it("expires exactly at the deadline without disabling the model itself", () => {
    const entry = { ...defaults, isNew: true, newUntil: "2026-09-13T12:00:00Z" };
    expect(isNewModel(entry, now - 1)).toBe(true);
    expect(isNewModel(entry, now)).toBe(false);
    expect(isNewModel({ ...entry, newUntil: null }, now)).toBe(true);
    expect(isNewModel({ ...entry, isNew: false }, now - 1)).toBe(false);
  });
  it("sorts launches independently and keeps provider/model pairs distinct", () => {
    const models = [
      model("same", "a", 2),
      model("same", "b", 1),
      { id: "ordinary", provider: "a" },
    ];
    expect(getNewModels(models, now).map((m) => m.provider)).toEqual(["b", "a"]);
    expect(models).toHaveLength(3);
    expect(getNewModelToken(models[0])).not.toEqual(getNewModelToken(models[1]));
  });
  it("does not reopen after sorting, text edits or expiry, but does for a new launch", () => {
    const a = model("a"),
      b = model("b");
    const dismissed = [getNewModelToken(a), getNewModelToken(b)];
    expect(
      hasUndismissedModels(
        [{ ...a, presentation: { ...a.presentation, displayName: "改名", sortOrder: 5 } }],
        dismissed,
      ),
    ).toBe(false);
    expect(hasUndismissedModels([b, a], dismissed)).toBe(false);
    expect(hasUndismissedModels([a, model("c")], dismissed)).toBe(true);
    expect(
      hasUndismissedModels(
        [{ ...a, presentation: { ...a.presentation, newRevision: "launch-2" } }],
        dismissed,
      ),
    ).toBe(true);
  });
  it("never advertises unavailable models or user-owned provider overrides", () => {
    const available = [
      { id: "same", provider: "a" },
      { id: "same", provider: "b" },
    ];
    const entries = [
      { ...model("same").presentation, provider: "a", modelId: "same" },
      { ...model("gone").presentation, provider: "a", modelId: "gone" },
    ];
    expect(withModelPresentations(available, entries, new Set(["a"]))).toEqual(available);
    const enriched = withModelPresentations(available, entries, new Set());
    expect(enriched).toHaveLength(2);
    expect(enriched[0]).toHaveProperty("presentation");
    expect(enriched[1]).not.toHaveProperty("presentation");
  });
});
