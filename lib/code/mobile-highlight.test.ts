import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { bundledLanguages, bundledThemes, codeToTokens } from "shiki/bundle/full";
import { resolveCodeTheme } from "./themes";

const runtime: Record<string, any> = { WebAssembly, TextDecoder, TextEncoder, console, atob };
runInNewContext(readFileSync("mobile/assets/web/code-highlighter.js", "utf8"), runtime);
const fixtures = JSON.parse(readFileSync("contracts/highlight-fixtures.json", "utf8")) as Array<{
  code: string;
  language: string;
}>;

describe("offline mobile Shiki parity", () => {
  it("keeps generated assets on the installed Shiki version", () => {
    const installed = JSON.parse(readFileSync("node_modules/shiki/package.json", "utf8"));
    const generated = JSON.parse(readFileSync("mobile/assets/web/shiki/version.json", "utf8"));
    expect(generated.shiki).toBe(installed.version);
  });
  it("retains native application languages instead of falling back to text", () => {
    for (const language of ["dart", "kotlin", "swift", "rust", "csharp"]) {
      expect(language in bundledLanguages).toBe(true);
    }
  });
  for (const theme of [
    "one",
    "vscode",
    "material",
    "gruvbox",
    "solarized",
    "github",
    "duotone",
    "dracula",
    "github-dark-high-contrast",
  ]) {
    for (const dark of [false, true]) {
      it(`${theme}, dark=${dark}: matches Web tokens, styles and surfaces`, async () => {
        await runtime.markaiHighlightReady;
        const resolved = resolveCodeTheme(theme, dark) as keyof typeof bundledThemes;
        const themeData = JSON.parse(
          readFileSync(`mobile/assets/web/shiki/themes/${resolved}.json`, "utf8"),
        );
        for (const fixture of fixtures) {
          const language = fixture.language in bundledLanguages ? fixture.language : "text";
          const grammars =
            language === "text"
              ? []
              : (await bundledLanguages[language as keyof typeof bundledLanguages]()).default;
          const local = grammars.map((grammar) =>
            JSON.parse(
              readFileSync(`mobile/assets/web/shiki/languages/${grammar.name}.json`, "utf8"),
            ),
          );
          const actual = runtime.markaiHighlight(
            fixture.code,
            language,
            resolved,
            local,
            themeData,
          );
          const expected = await codeToTokens(fixture.code, {
            lang: language as any,
            theme: resolved,
          });
          const tokens = expected.tokens.flatMap((line, index) => [
            ...(index ? [{ text: "\n" }] : []),
            ...line.map((token) => ({
              text: token.content,
              color: token.color,
              fontStyle: token.fontStyle || 0,
            })),
          ]);
          expect(JSON.parse(JSON.stringify(actual))).toEqual(
            JSON.parse(JSON.stringify({ tokens, fg: expected.fg, bg: expected.bg })),
          );
          expect(actual.tokens.map((token: { text: string }) => token.text).join("")).toBe(
            fixture.code,
          );
        }
      });
    }
  }
});
