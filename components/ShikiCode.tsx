"use client";
import { useEffect, useState } from "react";
import type { ThemedToken } from "shiki";

export function ShikiCode({
  code,
  language,
  theme,
  lineNumbers,
  wrap,
}: {
  code: string;
  language: string;
  theme: string;
  lineNumbers: boolean;
  wrap: boolean;
}) {
  const [result, setResult] = useState<{
    key: string;
    tokens: ThemedToken[][];
    bg?: string;
    fg?: string;
  }>();
  const key = `${theme}\0${language}\0${code}`;
  useEffect(() => {
    let active = true;
    void import("shiki/bundle/web")
      .then(async (shiki) => {
        const lang =
          language in shiki.bundledLanguages ||
          Object.values(shiki.bundledLanguagesInfo).some((item) => item.aliases?.includes(language))
            ? language
            : "text";
        const highlighted = await shiki.codeToTokens(code, {
          lang: lang as any,
          theme: theme as any,
        });
        if (active) setResult({ key, ...highlighted });
      })
      .catch(() => {
        if (active) setResult(undefined);
      });
    return () => {
      active = false;
    };
  }, [code, language, theme, key]);
  const current = result?.key === key ? result : undefined;
  const lines: Array<Array<{ content: string; color?: string; fontStyle?: number }>> =
    current?.tokens || code.split("\n").map((content) => [{ content }]);
  return (
    <pre
      className="m-0 p-4 text-[13px] leading-relaxed"
      style={{
        backgroundColor: current?.bg,
        color: current?.fg,
        whiteSpace: wrap ? "pre-wrap" : "pre",
        overflowWrap: wrap ? "anywhere" : undefined,
      }}
    >
      <code>
        {lines.map((tokens, index) => (
          <span key={index} className="flex min-h-[1.625em]">
            {lineNumbers && (
              <span
                aria-hidden="true"
                className="mr-4 w-7 shrink-0 select-none text-right opacity-40"
              >
                {index + 1}
              </span>
            )}
            <span className="min-w-0">
              {tokens.map((token, tokenIndex) => (
                <span
                  key={tokenIndex}
                  style={{
                    color: "color" in token ? token.color : undefined,
                    fontStyle:
                      "fontStyle" in token && (token.fontStyle || 0) & 1 ? "italic" : undefined,
                    fontWeight:
                      "fontStyle" in token && (token.fontStyle || 0) & 2 ? "bold" : undefined,
                    textDecoration:
                      "fontStyle" in token && (token.fontStyle || 0) & 4 ? "underline" : undefined,
                  }}
                >
                  {token.content}
                </span>
              ))}
            </span>
          </span>
        ))}
      </code>
    </pre>
  );
}
