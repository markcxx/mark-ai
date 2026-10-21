type Node = {
  type: string;
  value?: string;
  children?: Node[];
  data?: {
    hName?: string;
    hProperties?: { className: string[] };
    hChildren?: Node[];
  };
};

// U+20D7 is commonly generated in prose, but many UI fonts have no vector accent.
const proseVectors = /([\p{L}\p{N}])\u20d7/gu;
const mathVectors = /(\\[A-Za-z]+|[\p{L}\p{N}])\u20d7/gu;
const normalizeMath = (value: string) => {
  // Text groups use TeX text mode: enter math mode for the accent rather than inserting
  // a bare \vec command (which would invalidate the entire surrounding equation).
  const textGroup = /\\(?:text[a-z]*|operatorname\*?)\s*\{/g;
  let result = "";
  let offset = 0;
  for (let match = textGroup.exec(value); match; match = textGroup.exec(value)) {
    if (match.index < offset) continue;
    let end = textGroup.lastIndex;
    let depth = 1;
    while (end < value.length && depth) {
      if (value[end] === "\\") {
        end += 2;
        continue;
      }
      if (value[end] === "{") depth++;
      if (value[end] === "}") depth--;
      end++;
    }
    if (depth) break;
    result += value.slice(offset, match.index).replace(mathVectors, "\\vec{$1}");
    result += value.slice(match.index, end).replace(mathVectors, "$$\\vec{$1}$$");
    offset = end;
    textGroup.lastIndex = end;
  }
  return result + value.slice(offset).replace(mathVectors, "\\vec{$1}");
};

export const remarkUnicodeVectors = () => (tree: Node) => {
  const visit = (node: Node) => {
    if (node.type === "code" || node.type === "inlineCode" || node.type === "html") return;
    if (node.type === "math" || node.type === "inlineMath") {
      node.value = normalizeMath(node.value || "");
      // remark-math and our delimiter extension provide HAST children separately.
      const update = (child: Node) => {
        if (child.type === "text" && child.value) child.value = normalizeMath(child.value);
        child.children?.forEach(update);
      };
      node.data?.hChildren?.forEach(update);
      return;
    }
    if (!node.children) return;
    node.children = node.children.flatMap((child): Node[] => {
      if (child.type !== "text" || !child.value) {
        visit(child);
        return [child];
      }
      const result: Node[] = [];
      let offset = 0;
      for (const match of child.value.matchAll(proseVectors)) {
        if (match.index > offset)
          result.push({ type: "text", value: child.value.slice(offset, match.index) });
        const value = `\\vec{${match[1]}}`;
        result.push({
          type: "inlineMath",
          value,
          data: {
            hName: "code",
            hProperties: { className: ["language-math", "math-inline"] },
            hChildren: [{ type: "text", value }],
          },
        });
        offset = match.index + match[0].length;
      }
      if (!result.length) return [child];
      if (offset < child.value.length)
        result.push({ type: "text", value: child.value.slice(offset) });
      return result;
    });
  };
  visit(tree);
};
