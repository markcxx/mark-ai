import { describe, expect, it } from "vitest";

import { getWordContinuationPrompt, getWordContinuationToolNames } from "./workflow";

describe("Word workflow continuation", () => {
  it("requires the exact next action returned by a Word tool", () => {
    expect(
      getWordContinuationToolNames("word_document_inspect", {
        canFinalize: true,
        nextAction: { name: "word_document_finalize" },
      }),
    ).toEqual(["word_document_finalize"]);
  });

  it("allows the edit actions returned when an existing document is opened", () => {
    expect(
      getWordContinuationToolNames("word_document_open", {
        nextActions: ["word_document_restyle", "word_document_revise", "web_search"],
      }),
    ).toEqual(["word_document_restyle", "word_document_revise"]);
  });

  it("ends the workflow only after finalization", () => {
    expect(getWordContinuationToolNames("word_document_finalize", { success: true })).toEqual([]);
    expect(getWordContinuationToolNames("web_search", {})).toBeUndefined();
  });

  it("produces a strict continuation reminder", () => {
    expect(getWordContinuationPrompt(["word_document_inspect"])).toContain(
      "只有 word_document_finalize 成功后才能结束",
    );
  });
});
