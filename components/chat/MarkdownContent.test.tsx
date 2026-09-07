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

describe("LaTeX delimiter compatibility", () => {
  const render = (text: string) => renderToStaticMarkup(<MarkdownContent>{text}</MarkdownContent>);

  it("renders the inline symbols and display fractions from the screenshots", () => {
    const html = render(String.raw`- \(s\)：局域熵密度
- \(\mathbf{J}_s\)：熵流密度
- \(\sigma\)：局域熵产生率

固有频率为：
\[ f_n=\frac{\omega_n}{2\pi} \]

\[
f_n=\frac{\lambda_n^2}{2\pi L^2}\sqrt{\frac{EI}{m}}
\]`);
    expect(html.match(/class="katex"/g)).toHaveLength(5);
    expect(html.match(/class="katex-display"/g)).toHaveLength(2);
    expect(html).not.toContain("katex-error");
  });

  it("preserves matrix line breaks and math inside lists, quotes and tables", () => {
    const html = render(String.raw`> \[
> \begin{pmatrix}a & b \\ c & d\end{pmatrix}
> \]

- \(\mathbf{J}_{\alpha}\)

| 符号 | 含义 |
| --- | --- |
| \(\omega\) | 圆频率 |`);
    expect(html.match(/class="katex"/g)).toHaveLength(3);
    expect(html).not.toContain("katex-error");
  });

  it("does not reinterpret code, literal brackets, escaped delimiters or link destinations", () => {
    const html = render(
      [
        String.raw`普通 (s) 和 [文本]，价格 $20。`,
        "行内代码：`\\(x\\)`",
        "```text\n\\[x^2\\]\n```",
        "    \\(indented\\)",
        String.raw`\\(literal\\)`,
        String.raw`[链接](https://example.com/\(x\))`,
      ].join("\n\n"),
    );
    expect(html).not.toContain('class="katex"');
    expect(html).toContain("https://example.com/(x)");
  });

  it("does not prematurely render an unfinished streaming formula", () => {
    const formula = String.raw`\(\frac{a_1}{b_2}\)`;
    for (let i = 1; i < formula.length; i++) {
      expect(render(formula.slice(0, i))).not.toContain('class="katex"');
    }
    const html = renderToStaticMarkup(
      <MarkdownContent streaming animation="fade">
        {formula}
      </MarkdownContent>,
    );
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("katex-error");
  });
});

it("keeps standalone equals and blank lines inside a display equation", () => {
  const html = renderToStaticMarkup(
    <MarkdownContent>{String.raw`方程：
\[
\left(\mathbf M_s+\mathbf M_f\right)\ddot{\mathbf u}
+\mathbf C\dot{\mathbf u}+\mathbf K\mathbf u
=

\mathbf F_{\text{fluid}}(t)
\]

下一段。

普通标题
===`}</MarkdownContent>,
  );
  expect(html.match(/class="katex"/g)).toHaveLength(1);
  expect(html).not.toContain("katex-error");
  expect(html.match(/<h[12]/g)).toHaveLength(1);
  expect(html).toContain("下一段");
});

it("preserves display content in containers and surrounding prose", () => {
  const formula = String.raw`\[
\mathbf M\ddot{\mathbf u}
=
\mathbf F(t)
\]`;
  for (const prefix of ["> ", "  "]) {
    const text = prefix === "  " ? "- 方程：\n" : "";
    const html = renderToStaticMarkup(
      <MarkdownContent>
        {text +
          formula
            .split("\n")
            .map((line) => prefix + line)
            .join("\n") +
          "\n\n结束。"}
      </MarkdownContent>,
    );
    expect(html.match(/class="katex"/g)).toHaveLength(1);
    expect(html).not.toContain("katex-error");
    expect(html).toContain(String.raw`\mathbf M\ddot{\mathbf u}
=
\mathbf F(t)`);
    expect(html).toContain("结束。");
  }
  for (let i = 1; i < formula.length; i++) {
    expect(() =>
      renderToStaticMarkup(<MarkdownContent streaming>{formula.slice(0, i)}</MarkdownContent>),
    ).not.toThrow();
  }
});
