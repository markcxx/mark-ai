import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import { saveGeneratedFile } from "../generated-file";
import type { ToolExecutionContext, ToolExecutionResult } from "../types";

const MAX_CONTENT_CHARS = 60_000;

const inlineRuns = (value: string) => {
  const parts = value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part) => {
    const bold = part.startsWith("**") && part.endsWith("**");
    return new TextRun({
      bold,
      size: 22,
      text: bold ? part.slice(2, -2) : part,
    });
  });
};

const markdownParagraphs = (content: string, title: string) => {
  const paragraphs: Paragraph[] = [];
  for (const rawLine of content.replaceAll("\r\n", "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { after: 80 } }));
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      if (heading[1].length === 1 && heading[2].trim() === title.trim()) continue;
      const level =
        heading[1].length === 1
          ? HeadingLevel.HEADING_1
          : heading[1].length === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;
      paragraphs.push(
        new Paragraph({
          heading: level,
          spacing: { after: 160, before: 240 },
          text: heading[2].trim(),
        }),
      );
      continue;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: inlineRuns(bullet[1]),
          spacing: { after: 80, line: 340 },
        }),
      );
      continue;
    }

    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      paragraphs.push(
        new Paragraph({
          children: inlineRuns(numbered[1]),
          numbering: { level: 0, reference: "markai-numbering" },
          spacing: { after: 80, line: 340 },
        }),
      );
      continue;
    }

    paragraphs.push(
      new Paragraph({
        children: inlineRuns(trimmed),
        spacing: { after: 140, line: 360 },
      }),
    );
  }
  return paragraphs;
};

export const executeCreateWord = async (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  const title = typeof args.title === "string" ? args.title.trim().slice(0, 160) : "";
  const content = typeof args.content === "string" ? args.content.trim() : "";
  const filename = typeof args.filename === "string" ? args.filename : undefined;
  if (!title || !content) throw new Error("Word 文档标题和内容不能为空");
  if (content.length > MAX_CONTENT_CHARS) throw new Error("Word 文档内容过长");

  const document = new Document({
    numbering: {
      config: [
        {
          levels: [
            {
              alignment: AlignmentType.START,
              format: LevelFormat.DECIMAL,
              level: 0,
              style: { paragraph: { indent: { hanging: 360, left: 720 } } },
              text: "%1.",
            },
          ],
          reference: "markai-numbering",
        },
      ],
    },
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ bold: true, size: 36, text: title })],
            spacing: { after: 420 },
          }),
          ...markdownParagraphs(content, title),
        ],
        properties: {
          page: {
            margin: { bottom: 1280, left: 1440, right: 1440, top: 1280 },
          },
        },
      },
    ],
    styles: {
      default: {
        document: {
          run: { font: "Microsoft YaHei", size: 22 },
        },
      },
    },
  });
  const buffer = await Packer.toBuffer(document);
  const file = await saveGeneratedFile({
    bytes: new Uint8Array(buffer),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: ".docx",
    fallbackName: title,
    filename,
    userId: context.userId,
  });

  return {
    content: {
      downloadUrl: file.url,
      filename: file.name,
      message: "Word document created successfully.",
    },
    file,
  };
};
