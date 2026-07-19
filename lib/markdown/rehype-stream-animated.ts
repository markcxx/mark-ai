type HastNode = {
  children?: HastNode[];
  properties?: Record<string, unknown>;
  tagName?: string;
  type: string;
  value?: string;
};

const blockTags = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"]);
const skipTags = new Set(["pre", "code", "table", "svg"]);
const wordPattern = /\s+|\S+/g;
const wordSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "word" })
    : undefined;

const hasClass = (node: HastNode, className: string) => {
  const value = node.properties?.className;
  if (Array.isArray(value)) return value.some((item) => String(item).includes(className));
  return typeof value === "string" && value.includes(className);
};

const segmentWords = (value: string) => {
  if (!wordSegmenter) return value.match(wordPattern) || [];
  return Array.from(wordSegmenter.segment(value), (item) => item.segment);
};

const animatedSpan = (value: string): HastNode => ({
  children: [{ type: "text", value }],
  properties: { className: "stream-char" },
  tagName: "span",
  type: "element",
});

export const rehypeStreamAnimated = ({ granularity = "char" }: { granularity?: "char" | "word" } = {}) =>
  (tree: HastNode) => {
    const shouldSkip = (node: HastNode) =>
      Boolean(node.tagName && skipTags.has(node.tagName)) || hasClass(node, "katex");

    const wrapText = (node: HastNode) => {
      if (!node.children) return;
      const children: HastNode[] = [];

      for (const child of node.children) {
        if (child.type === "text" && child.value) {
          const segments = granularity === "word" ? segmentWords(child.value) : Array.from(child.value);
          for (const segment of segments) {
            children.push(segment.trim() ? animatedSpan(segment) : { type: "text", value: segment });
          }
        } else {
          if (child.type === "element" && !shouldSkip(child)) wrapText(child);
          children.push(child);
        }
      }

      node.children = children;
    };

    const visit = (node: HastNode) => {
      if (shouldSkip(node)) return;
      if (node.tagName && blockTags.has(node.tagName)) {
        wrapText(node);
        return;
      }
      node.children?.forEach(visit);
    };

    visit(tree);
  };

