import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownContent } from "./MarkdownContent";

describe("MarkdownContent math rendering", () => {
  it("renders inline and block LaTeX with KaTeX", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent>{`行内公式 $d_{ff}=2048$。

$$
PE_{(pos, 2i)} = \\sin(pos / 10000^{2i/d_{\\text{model}}})
$$`}</MarkdownContent>,
    );

    expect(html).toContain("katex-display");
    expect(html).toContain("katex-mathml");
    expect(html).toContain('annotation encoding="application/x-tex"');
    expect(html).toContain("d_{ff}=2048");
    expect(html).toContain("PE_{(pos, 2i)}");
  });

  it("keeps KaTeX intact while response animation is enabled", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent animation="fade" streaming>
        {"公式：$x^2 + y^2 = z^2$"}
      </MarkdownContent>,
    );

    expect(html).toContain("streaming-markdown");
    expect(html).toContain("katex");
    expect(html).not.toMatch(/katex[^>]*>\s*<span class="stream-char"/);
  });
});
