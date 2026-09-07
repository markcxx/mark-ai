import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContextWindowIndicator } from "./ContextWindowIndicator";

// The indicator must reflect retained content, never stale request billing usage.
const render = (draft = "", modelId = "gpt-6-astra", totalTokens = 999999) =>
  renderToStaticMarkup(
    React.createElement(ContextWindowIndicator, {
      attachments: [],
      draft,
      messages: [{ id: "reply", role: "model", content: "你好", totalTokens }],
      modelId,
      webSearchEnabled: false,
    }),
  );

describe("context indicator", () => {
  it("remains available when the model context limit is unknown", () => {
    expect(render("", "custom-model")).toContain("上限未知");
    expect(render("", "custom-model")).toContain("查看上下文占用");
  });

  it("ignores historical billing totals and updates with the draft", () => {
    expect(render()).toContain("&lt;1%");
    expect(render("中文".repeat(20000))).not.toContain("&lt;1%");
  });
});
