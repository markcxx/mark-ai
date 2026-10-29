import type { WebImage } from "../chat/types";

export type WebImageCandidate = Omit<WebImage, "id">;

export function publicResourceUrl(value: unknown, base?: string): string | undefined {
  if (typeof value !== "string" || value.length > 4096 || !value.trim()) return undefined;
  try {
    const url = new URL(value.replaceAll("&amp;", "&"), base);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return undefined;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      /^(localhost(?:\.|$)|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(
        host,
      ) ||
      /(?:\.local|\.internal|\.localhost)$/.test(host) ||
      host.includes(":") ||
      (/^\d+\./.test(host) && Number(host.split(".")[0]) >= 224)
    )
      return undefined;
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

const cleanText = (value: unknown) =>
  typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 300)
    : "";

export function normalizeWebImages(values: unknown[], sourceUrl?: string): WebImageCandidate[] {
  const unique = new Map<string, WebImageCandidate>();
  for (const value of values) {
    const item =
      typeof value === "string" ? { url: value } : (value as Record<string, unknown> | null);
    if (!item || typeof item !== "object") continue;
    const url = publicResourceUrl(item.url, sourceUrl);
    if (
      !url ||
      /\.(?:svg|ico)(?:\?|$)|(?:^|[\/_-])(?:logo|favicon|avatar|tracking|pixel)(?:[\/_\-.?]|$)/i.test(
        url,
      )
    )
      continue;
    if (
      (typeof item.width === "number" && item.width < 120) ||
      (typeof item.height === "number" && item.height < 80)
    )
      continue;
    const existing = unique.get(url);
    unique.set(url, {
      url,
      title:
        existing?.title !== "网页图片" && existing?.title
          ? existing.title
          : cleanText(item.title || item.alt || item.description) || "网页图片",
      description: existing?.description || cleanText(item.description || item.alt) || undefined,
      sourceUrl:
        existing?.sourceUrl || publicResourceUrl(item.sourceUrl || item.source_url || sourceUrl),
    });
    if (unique.size >= 12) break;
  }
  return [...unique.values()];
}

const attribute = (tag: string, name: string) => {
  const match = tag.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3];
};

const markdownImagePattern =
  /!\[([^\]]*)\]\(\s*(<?https?:\/\/[^\s)>]+>?|[^\s)>]+)(?:\s+["'][^)]*["'])?\s*\)/g;
const markdownContextText = (value: string) =>
  value
    .replace(markdownImagePattern, " ")
    .replace(/\[([^\]]*)\]\([^\s)]+(?:\s+["'][^)]*["'])?\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function extractWebImages(
  content: string,
  sourceUrl: string,
  extra: unknown[] = [],
): WebImageCandidate[] {
  const candidates: unknown[] = [];
  const main =
    content.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1] || content;
  const cleaned = main.replace(/<(script|style|nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, " ");
  const headings = [...cleaned.matchAll(/^ {0,3}#{1,6}[\t ]+(.+?)[\t ]*#*[\t ]*$/gm)];
  let headingIndex = -1;
  for (const match of cleaned.matchAll(markdownImagePattern)) {
    while (headings[headingIndex + 1] && headings[headingIndex + 1].index < match.index)
      headingIndex++;
    const heading = headings[headingIndex];
    const sectionStart = heading ? heading.index + heading[0].length : 0;
    const sectionEnd = headings[headingIndex + 1]?.index ?? cleaned.length;
    const before = markdownContextText(
      cleaned.slice(Math.max(sectionStart, match.index - 600), match.index),
    ).slice(-120);
    const after = markdownContextText(
      cleaned.slice(
        match.index + match[0].length,
        Math.min(sectionEnd, match.index + match[0].length + 600),
      ),
    ).slice(0, 120);
    const alt = cleanText(match[1]).slice(0, 80);
    const section = heading && cleanText(heading[1]).slice(0, 60);
    const nearby = cleanText(`${before} ${after}`);
    candidates.push({
      url: match[2].replace(/^<|>$/g, ""),
      alt: match[1],
      description: [
        alt && `图片说明：${alt}`,
        section && `所属小节：${section}`,
        nearby && `相邻正文：${nearby}`,
      ]
        .filter(Boolean)
        .join("；"),
    });
  }
  for (const match of cleaned.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const before = cleaned.slice(0, match.index);
    const figureStart = before.lastIndexOf("<figure");
    const figureEnd = cleaned.indexOf("</figure>", match.index);
    const figure =
      figureStart > before.lastIndexOf("</figure>") && figureEnd >= 0
        ? cleaned.slice(figureStart, figureEnd)
        : "";
    const caption = cleanText(figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1]);
    const nearby = cleanText(
      cleaned.slice(Math.max(0, match.index - 240), match.index) +
        " " +
        cleaned.slice(match.index + tag.length, match.index + tag.length + 240),
    );
    const srcset = attribute(tag, "srcset")?.split(",").at(-1)?.trim().split(/\s+/)[0];
    candidates.push({
      url:
        attribute(tag, "data-src") ||
        attribute(tag, "data-original") ||
        srcset ||
        attribute(tag, "src"),
      title: attribute(tag, "alt") || caption || attribute(tag, "title"),
      description: [caption && `图片说明：${caption}`, nearby && `相邻正文：${nearby}`]
        .filter(Boolean)
        .join("；"),
      width: Number(attribute(tag, "width")) || undefined,
      height: Number(attribute(tag, "height")) || undefined,
    });
  }
  candidates.push(...extra);
  // Social preview is a fallback when the page exposes no body images.
  if (!candidates.length) {
    for (const match of content.matchAll(/<meta\b[^>]*>/gi)) {
      if (
        /^(og:image|twitter:image)$/i.test(
          attribute(match[0], "property") || attribute(match[0], "name") || "",
        )
      )
        candidates.push(attribute(match[0], "content"));
    }
  }
  return normalizeWebImages(candidates, sourceUrl);
}

export function extractWebLinks(content: string, sourceUrl: string): string[] {
  const links = new Set<string>();
  for (const match of content.matchAll(
    /(?:href\s*=\s*["']([^"']+)["']|(?<!!)\[[^\]]*\]\(([^\s)]+))/gi,
  )) {
    const url = publicResourceUrl(match[1] || match[2], sourceUrl);
    if (url && !/\.(?:jpg|jpeg|png|webp|gif|svg|zip|exe)(?:\?|$)/i.test(url)) links.add(url);
    if (links.size >= 50) break;
  }
  return [...links];
}
