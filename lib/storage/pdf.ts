type PdfParse = typeof import("pdf-parse/lib/pdf-parse.js").default;

let parserPromise: Promise<PdfParse> | undefined;

const getPdfParser = () => {
  parserPromise ??= import("pdf-parse/lib/pdf-parse.js").then((module) => module.default);
  return parserPromise;
};

const normalizePageText = (value: string) =>
  value
    .replaceAll("\0", "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const extractPdfContent = async (bytes: Uint8Array) => {
  const parsePdf = await getPdfParser();
  let pageNumber = 0;
  const result = await parsePdf(Buffer.from(bytes), {
    max: 200,
    pagerender: async (page) => {
      pageNumber += 1;
      const textContent = await page.getTextContent();
      let lastY: number | undefined;
      const lines: string[] = [];

      for (const item of textContent.items) {
        if (!item.str) continue;
        const y = item.transform?.[5];
        if (lastY !== undefined && y !== undefined && Math.abs(y - lastY) > 0.5) {
          lines.push("\n");
        } else if (lines.length > 0 && !lines[lines.length - 1].endsWith("\n")) {
          lines.push(" ");
        }
        lines.push(item.str);
        lastY = y;
      }

      const content = normalizePageText(lines.join(""));
      return content ? `--- 第 ${pageNumber} 页 ---\n${content}` : "";
    },
  });
  const content = normalizePageText(result.text);

  if (!content) {
    throw new Error("PDF 中没有提取到可读文字，文件可能是扫描件或仅包含图片");
  }

  return {
    content: `[PDF，共 ${result.numpages} 页${result.numrender < result.numpages ? `，已解析前 ${result.numrender} 页` : ""}]\n\n${content}`,
    pageCount: result.numpages,
  };
};
