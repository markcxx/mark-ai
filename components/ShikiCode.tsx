"use client";
import { useEffect, useRef, useState } from "react";
import type { ThemedToken } from "shiki";
import { highlightCode, loadHighlighter } from "@/lib/code/highlight";

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
  const lastRun = useRef(0);
  useEffect(() => {
    let active = true;
    // Throttle continuous streaming, but always process the final revision.
    const timer = setTimeout(
      () => {
        lastRun.current = Date.now();
        void loadHighlighter()
          .then(() => (active ? highlightCode(code, language, theme) : undefined))
          .then((highlighted) => {
            if (active && highlighted) setResult({ key, ...highlighted });
          })
          .catch(() => {
            if (active) setResult(undefined);
          });
      },
      Math.max(0, 100 - (Date.now() - lastRun.current)),
    );
    return () => {
      active = false;
      clearTimeout(timer);
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
