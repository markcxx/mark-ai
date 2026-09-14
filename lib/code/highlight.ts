import type { TokensResult } from "shiki";
import type { BundledLanguage, BundledTheme } from "shiki/bundle/full";

let runtime: Promise<typeof import("shiki/bundle/full")> | undefined;
export const loadHighlighter = () =>
  (runtime ??= import("shiki/bundle/full").catch((error) => {
    runtime = undefined;
    throw error;
  }));

const cache = new Map<string, TokensResult>();
const pending = new Map<string, Promise<TokensResult>>();
const MAX_CHARACTERS = 256 * 1024;
let characters = 0;

export async function highlightCode(code: string, language: string, theme: string) {
  const key = `${theme}\0${language}\0${code}`;
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  const existing = pending.get(key);
  if (existing) return existing;
  const task = (async () => {
    const shiki = await loadHighlighter();
    const lang = language in shiki.bundledLanguages ? language : "text";
    const result = await shiki.codeToTokens(code, {
      lang: lang as BundledLanguage,
      theme: theme as BundledTheme,
    });
    if (key.length <= MAX_CHARACTERS) {
      cache.set(key, result);
      characters += key.length;
      while (cache.size > 32 || characters > MAX_CHARACTERS) {
        const oldest = cache.keys().next().value!;
        characters -= oldest.length;
        cache.delete(oldest);
      }
    }
    return result;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}
