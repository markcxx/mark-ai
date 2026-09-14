import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import wasm from "shiki/wasm";

// Bundled WASM, grammars and themes never need a network request.
const ready = createHighlighterCore({
  themes: [],
  langs: [],
  engine: createOnigurumaEngine(wasm),
});
(globalThis as any).markaiHighlightReady = ready
  .then((highlighter) => {
    (globalThis as any).markaiHighlight = (
      code: string,
      language: string,
      theme: string,
      grammars: any[],
      themeData: any,
    ) => {
      if (grammars.length) highlighter.loadLanguageSync(...grammars);
      if (themeData) highlighter.loadThemeSync(themeData);
      const result = highlighter.codeToTokens(code, { lang: language, theme });
      const tokens = result.tokens.flatMap((line, index) => [
        ...(index ? [{ text: "\n" }] : []),
        ...line.map((token) => ({
          text: token.content,
          color: token.color,
          fontStyle: token.fontStyle || 0,
        })),
      ]);
      return { tokens, fg: result.fg, bg: result.bg };
    };
    (globalThis as any).MarkAIHighlightReady?.postMessage("ready");
  })
  .catch((error) => {
    (globalThis as any).MarkAIHighlightReady?.postMessage("error");
    throw error;
  });
