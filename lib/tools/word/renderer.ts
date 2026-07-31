import {
  AlignmentType,
  Bookmark,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  InternalHyperlink,
  LeaderType,
  LevelFormat,
  LineRuleType,
  PageBreak,
  PageNumber,
  PageReference,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopPosition,
  TabStopType,
  TextRun,
  VerticalAlignTable,
  WidthType,
} from "docx";

import { getWordDocumentPreset, type WordDocumentPreset, type WordTextStyleToken } from "./presets";
import type {
  WordDocumentBlock,
  WordDocumentJob,
  WordDocumentStyleScope,
  WordDocumentTextStyleOverride,
  WordParagraphFormat,
  WordTextRun,
} from "./types";

const alignmentByName = {
  center: AlignmentType.CENTER,
  justified: AlignmentType.JUSTIFIED,
  left: AlignmentType.LEFT,
  right: AlignmentType.RIGHT,
} as const;

const toTwips = (points: number) => Math.round(points * 20);

const getFontAttributes = (preset: WordDocumentPreset, override?: string) => ({
  ascii: override || preset.font.latin,
  cs: override || preset.font.eastAsia,
  eastAsia: override || preset.font.eastAsia,
  hAnsi: override || preset.font.latin,
});

const getStyleOverride = (job: WordDocumentJob, scope: WordDocumentStyleScope) => ({
  ...job.styleOverrides?.["all-text"],
  ...(scope === "all-text" ? {} : job.styleOverrides?.[scope]),
});

const applyTextStyleOverride = (
  token: WordTextStyleToken,
  override: WordDocumentTextStyleOverride,
): WordTextStyleToken => ({
  ...token,
  ...(override.color ? { color: override.color } : {}),
  ...(override.size ? { size: override.size } : {}),
});

const getTextWidthScore = (value: string) =>
  Array.from(value).reduce(
    (score, character) => score + (/[^\u0000-\u00ff]/.test(character) ? 2 : 1),
    0,
  );

export const calculateTableColumnWidths = (rows: string[][], totalWidth: number) => {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  if (columnCount === 1) return [totalWidth];

  const scores = Array.from({ length: columnCount }, (_, columnIndex) => {
    const longest = Math.max(1, ...rows.map((row) => getTextWidthScore(row[columnIndex] || "")));
    return Math.min(48, Math.max(6, longest));
  });
  const minimumWidth = Math.min(900, Math.floor(totalWidth / columnCount / 1.35));
  const distributable = totalWidth - minimumWidth * columnCount;
  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const widths = scores.map(
    (score) => minimumWidth + Math.floor((distributable * score) / totalScore),
  );
  widths[widths.length - 1] += totalWidth - widths.reduce((sum, width) => sum + width, 0);
  return widths;
};

const styleParagraph = (token: WordTextStyleToken, firstLineIndentChars = 0) => ({
  alignment: alignmentByName[token.alignment],
  indent: { firstLine: Math.round(firstLineIndentChars * 220) },
  spacing: {
    after: toTwips(token.after),
    before: toTwips(token.before),
    line: Math.round(token.lineSpacing * 240),
    lineRule: LineRuleType.AUTO,
  },
});

const styleRun = (
  preset: WordDocumentPreset,
  token: WordTextStyleToken,
  fontOverride?: string,
) => ({
  bold: token.bold,
  color: token.color,
  font: getFontAttributes(preset, fontOverride),
  size: Math.round(token.size * 2),
});

const paragraphOverrides = (format?: WordParagraphFormat) => {
  if (!format) return {};
  const hasSpacing =
    format.lineSpacing !== undefined ||
    format.spacingAfter !== undefined ||
    format.spacingBefore !== undefined;
  return {
    ...(format.alignment ? { alignment: alignmentByName[format.alignment] } : {}),
    ...(format.firstLineIndentChars !== undefined
      ? { indent: { firstLine: Math.round(format.firstLineIndentChars * 220) } }
      : {}),
    ...(format.keepNext !== undefined ? { keepNext: format.keepNext } : {}),
    ...(hasSpacing
      ? {
          spacing: {
            ...(format.spacingAfter !== undefined ? { after: toTwips(format.spacingAfter) } : {}),
            ...(format.spacingBefore !== undefined
              ? { before: toTwips(format.spacingBefore) }
              : {}),
            ...(format.lineSpacing !== undefined
              ? {
                  line: Math.round(format.lineSpacing * 240),
                  lineRule: LineRuleType.AUTO,
                }
              : {}),
          },
        }
      : {}),
  };
};

const createRuns = (text: string | undefined, runs: WordTextRun[] | undefined) => {
  const source = runs || [{ text: text || "" }];
  return source.map(
    (run) =>
      new TextRun({
        bold: run.bold,
        color: run.color,
        font: run.font,
        highlight: run.highlight,
        italics: run.italics,
        size: run.size ? Math.round(run.size * 2) : undefined,
        strike: run.strike,
        text: run.text,
        underline: run.underline ? {} : undefined,
      }),
  );
};

const createHeading = (
  block: Extract<WordDocumentBlock, { type: "heading" }>,
  preset: WordDocumentPreset,
  bookmarkId?: string,
) => {
  const headings = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  } as const;
  return new Paragraph({
    ...paragraphOverrides(block.format),
    children: bookmarkId
      ? [new Bookmark({ children: [new TextRun({ text: block.text })], id: bookmarkId })]
      : [new TextRun({ text: block.text })],
    heading: headings[block.level],
    keepNext: block.format?.keepNext ?? true,
    numbering:
      preset.headingNumbering === "none"
        ? undefined
        : { level: block.level - 1, reference: "markai-headings" },
  });
};

const createParagraph = (block: Extract<WordDocumentBlock, { type: "paragraph" }>) => {
  const style = {
    body: "MarkAIBody",
    caption: "MarkAICaption",
    note: "MarkAINote",
  }[block.style || "body"];
  return new Paragraph({
    ...paragraphOverrides(block.format),
    children: createRuns(block.text, block.runs),
    style,
  });
};

const createQuote = (block: Extract<WordDocumentBlock, { type: "quote" }>) =>
  new Paragraph({
    ...paragraphOverrides(block.format),
    children: createRuns(block.text, block.runs),
    style: "MarkAIQuote",
  });

const createList = (block: Extract<WordDocumentBlock, { type: "list" }>) =>
  block.items.map(
    (item) =>
      new Paragraph({
        ...paragraphOverrides(block.format),
        children: [new TextRun({ text: item })],
        numbering: {
          level: block.level || 0,
          reference: block.ordered ? "markai-numbering" : "markai-bullets",
        },
        style: "MarkAIList",
      }),
  );

const isCompactTableValue = (value: string) => {
  const trimmed = value.trim();
  return (
    getTextWidthScore(trimmed) <= 18 &&
    (/^[\d\s.,%$¥￥+\-/:年月日时分秒]+$/.test(trimmed) ||
      /^(是|否|完成|未完成|通过|不通过|高|中|低|正常|异常|待定|yes|no|done|pending)$/i.test(
        trimmed,
      ))
  );
};

const createTable = (
  block: Extract<WordDocumentBlock, { type: "table" }>,
  preset: WordDocumentPreset,
) => {
  const columnWidths = calculateTableColumnWidths(block.rows, preset.table.width);
  const border = { color: preset.palette.border, size: 4, style: BorderStyle.SINGLE };
  const noBorder = { color: "FFFFFF", size: 0, style: BorderStyle.NIL };
  const borders =
    preset.table.style === "minimal"
      ? {
          bottom: border,
          insideHorizontal: border,
          insideVertical: noBorder,
          left: noBorder,
          right: noBorder,
          top: border,
        }
      : {
          bottom: border,
          insideHorizontal: border,
          insideVertical: border,
          left: border,
          right: border,
          top: border,
        };
  return new Table({
    borders,
    columnWidths,
    indent: { size: preset.table.indent, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    margins: {
      bottom: preset.table.cellMargins.bottom,
      left: preset.table.cellMargins.left,
      right: preset.table.cellMargins.right,
      top: preset.table.cellMargins.top,
    },
    rows: block.rows.map(
      (row, rowIndex) =>
        new TableRow({
          children: row.map((cell, columnIndex) => {
            const header = Boolean(block.header && rowIndex === 0);
            const alignment =
              header || isCompactTableValue(cell) ? AlignmentType.CENTER : AlignmentType.LEFT;
            return new TableCell({
              children: [
                new Paragraph({
                  alignment,
                  children: [new TextRun({ text: cell })],
                  style: header ? "MarkAITableHeader" : "MarkAITableBody",
                }),
              ],
              margins: {
                bottom: preset.table.cellMargins.bottom,
                left: preset.table.cellMargins.left,
                right: preset.table.cellMargins.right,
                top: preset.table.cellMargins.top,
              },
              shading: header
                ? { fill: preset.table.headerFill, type: ShadingType.CLEAR }
                : preset.table.alternateRows && rowIndex % 2 === 0
                  ? { fill: preset.table.alternateRowFill, type: ShadingType.CLEAR }
                  : undefined,
              verticalAlign: VerticalAlignTable.CENTER,
              width: { size: columnWidths[columnIndex], type: WidthType.DXA },
            });
          }),
          tableHeader: Boolean(block.header && rowIndex === 0),
        }),
    ),
    width: { size: preset.table.width, type: WidthType.DXA },
  });
};

const createBlockChildren = (job: WordDocumentJob, preset: WordDocumentPreset) =>
  job.blocks.flatMap((block, blockIndex) => {
    switch (block.type) {
      case "heading":
        return [createHeading(block, preset, `markai-heading-${blockIndex + 1}`)];
      case "paragraph":
        return [createParagraph(block)];
      case "quote":
        return [createQuote(block)];
      case "list":
        return createList(block);
      case "table":
        return [
          createTable(block, preset),
          new Paragraph({ children: [new TextRun({ text: "" })], style: "MarkAITableSpacer" }),
        ];
      case "page-break":
        return [new Paragraph({ children: [new PageBreak()] })];
    }
  });

const createTableOfContents = (job: WordDocumentJob) => {
  const headings = job.blocks.flatMap((block, blockIndex) =>
    block.type === "heading"
      ? [{ bookmarkId: `markai-heading-${blockIndex + 1}`, level: block.level, text: block.text }]
      : [],
  );

  return [
    new Paragraph({
      children: [new TextRun({ text: "目录" })],
      heading: HeadingLevel.HEADING_1,
    }),
    ...headings.map(
      (heading) =>
        new Paragraph({
          children: [
            new InternalHyperlink({
              anchor: heading.bookmarkId,
              children: [new TextRun({ text: heading.text })],
            }),
            new TextRun({ text: "\t" }),
            new PageReference(heading.bookmarkId, { hyperlink: true }),
          ],
          style: `MarkAIToc${heading.level}`,
          tabStops: [
            {
              leader: LeaderType.DOT,
              position: TabStopPosition.MAX,
              type: TabStopType.RIGHT,
            },
          ],
        }),
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ];
};

const createParagraphStyles = (job: WordDocumentJob, preset: WordDocumentPreset) => {
  const titleOverride = getStyleOverride(job, "title");
  const headingOverride = getStyleOverride(job, "headings");
  const bodyOverride = getStyleOverride(job, "body");
  const tableOverride = getStyleOverride(job, "tables");
  const title = applyTextStyleOverride(preset.title, titleOverride);
  const body = applyTextStyleOverride(preset.body, bodyOverride);
  const headings = {
    1: applyTextStyleOverride(preset.headings[1], headingOverride),
    2: applyTextStyleOverride(preset.headings[2], headingOverride),
    3: applyTextStyleOverride(preset.headings[3], headingOverride),
  };

  return [
    {
      basedOn: "Normal",
      id: "MarkAITitle",
      name: "MarkAI Title",
      next: "MarkAIBody",
      paragraph: {
        ...styleParagraph(title),
        ...(preset.title.rule
          ? {
              border: {
                bottom: {
                  color: preset.title.ruleColor,
                  size: 6,
                  space: 10,
                  style: BorderStyle.SINGLE,
                },
              },
            }
          : {}),
        keepNext: true,
      },
      quickFormat: true,
      run: styleRun(preset, title, titleOverride.font),
    },
    ...([1, 2, 3] as const).map((level) => ({
      basedOn: "Normal",
      id: `Heading${level}`,
      name: `heading ${level}`,
      next: "MarkAIBody",
      paragraph: {
        ...styleParagraph(headings[level]),
        keepNext: true,
        keepLines: true,
        outlineLevel: level - 1,
      },
      quickFormat: true,
      run: styleRun(preset, headings[level], headingOverride.font),
    })),
    {
      basedOn: "Normal",
      id: "MarkAIBody",
      name: "MarkAI Body",
      next: "MarkAIBody",
      paragraph: styleParagraph(body, preset.body.firstLineIndentChars),
      quickFormat: true,
      run: styleRun(preset, body, bodyOverride.font),
    },
    {
      basedOn: "MarkAIBody",
      id: "MarkAIList",
      name: "MarkAI List",
      next: "MarkAIList",
      paragraph: {
        spacing: {
          after: toTwips(preset.list.after),
          line: Math.round(body.lineSpacing * 240),
          lineRule: LineRuleType.AUTO,
        },
      },
      run: styleRun(preset, body, bodyOverride.font),
    },
    {
      basedOn: "Normal",
      id: "MarkAIKicker",
      name: "MarkAI Kicker",
      next: "MarkAITitle",
      paragraph: {
        alignment: preset.opening.layout === "cover" ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: toTwips(6), before: 0, line: 240, lineRule: LineRuleType.AUTO },
      },
      run: {
        bold: true,
        color: preset.palette.accent,
        font: getFontAttributes(preset, titleOverride.font),
        size: 19,
      },
    },
    {
      basedOn: "Normal",
      id: "MarkAISubtitle",
      name: "MarkAI Subtitle",
      next: "MarkAIBody",
      paragraph: {
        alignment: alignmentByName[preset.title.alignment],
        spacing: { after: toTwips(12), before: 0, line: 280, lineRule: LineRuleType.AUTO },
      },
      run: {
        color: preset.palette.muted,
        font: getFontAttributes(preset, titleOverride.font),
        size: 24,
      },
    },
    {
      basedOn: "Normal",
      id: "MarkAIMetadata",
      name: "MarkAI Metadata",
      next: "MarkAIMetadata",
      paragraph: {
        alignment:
          preset.opening.layout === "notice"
            ? AlignmentType.RIGHT
            : preset.opening.layout === "cover" || preset.opening.layout === "legal"
              ? AlignmentType.CENTER
              : AlignmentType.LEFT,
        spacing: { after: toTwips(3), before: 0, line: 250, lineRule: LineRuleType.AUTO },
      },
      run: {
        color: preset.palette.muted,
        font: getFontAttributes(preset, bodyOverride.font),
        size: 18,
      },
    },
    {
      basedOn: "MarkAIBody",
      id: "MarkAINote",
      name: "MarkAI Note",
      next: "MarkAIBody",
      paragraph: {
        border: {
          left: {
            color: preset.palette.accent,
            size: 12,
            space: 10,
            style: BorderStyle.SINGLE,
          },
        },
        indent: { left: 240, right: 120 },
        shading: { fill: preset.palette.calloutFill, type: ShadingType.CLEAR },
        spacing: { after: toTwips(8), before: toTwips(4), line: 280, lineRule: LineRuleType.AUTO },
      },
      run: {
        ...styleRun(preset, body, bodyOverride.font),
        color: bodyOverride.color || preset.palette.muted,
        size: Math.round((bodyOverride.size || 10) * 2),
      },
    },
    {
      basedOn: "MarkAIBody",
      id: "MarkAIQuote",
      name: "MarkAI Quote",
      next: "MarkAIBody",
      paragraph: {
        border: {
          left: {
            color: preset.palette.accent,
            size: 10,
            space: 10,
            style: BorderStyle.SINGLE,
          },
        },
        indent: { left: 360, right: 180 },
        shading: { fill: preset.palette.calloutFill, type: ShadingType.CLEAR },
        spacing: { after: toTwips(8), before: toTwips(4), line: 300, lineRule: LineRuleType.AUTO },
      },
      run: {
        ...styleRun(preset, body, bodyOverride.font),
        color: bodyOverride.color || preset.palette.muted,
        italics: true,
      },
    },
    {
      basedOn: "MarkAIBody",
      id: "MarkAICaption",
      name: "MarkAI Caption",
      next: "MarkAIBody",
      paragraph: {
        alignment: AlignmentType.CENTER,
        spacing: { after: toTwips(8), before: toTwips(3), line: 260, lineRule: LineRuleType.AUTO },
      },
      run: {
        ...styleRun(preset, body, bodyOverride.font),
        color: bodyOverride.color || preset.palette.muted,
        italics: true,
        size: Math.round((bodyOverride.size || 9) * 2),
      },
    },
    {
      basedOn: "Normal",
      id: "MarkAITableHeader",
      name: "MarkAI Table Header",
      paragraph: {
        spacing: { after: 0, before: 0, line: 264, lineRule: LineRuleType.AUTO },
      },
      run: {
        bold: true,
        color: tableOverride.color || preset.table.headerTextColor,
        font: getFontAttributes(preset, tableOverride.font),
        size: Math.round((tableOverride.size || preset.table.bodyFontSize) * 2),
      },
    },
    {
      basedOn: "Normal",
      id: "MarkAITableBody",
      name: "MarkAI Table Body",
      paragraph: {
        spacing: { after: 0, before: 0, line: 264, lineRule: LineRuleType.AUTO },
      },
      run: {
        color: tableOverride.color || preset.body.color,
        font: getFontAttributes(preset, tableOverride.font),
        size: Math.round((tableOverride.size || preset.table.bodyFontSize) * 2),
      },
    },
    {
      basedOn: "Normal",
      id: "MarkAITableSpacer",
      name: "MarkAI Table Spacer",
      paragraph: { spacing: { after: toTwips(3), before: 0, line: 80 } },
      run: { font: getFontAttributes(preset, bodyOverride.font), size: 4 },
    },
    ...([1, 2, 3] as const).map((level) => ({
      basedOn: "Normal",
      id: `MarkAIToc${level}`,
      name: `MarkAI TOC ${level}`,
      paragraph: {
        indent: { left: (level - 1) * 360 },
        spacing: {
          after: toTwips(level === 1 ? 7 : 4),
          before: toTwips(level === 1 ? 3 : 0),
          line: 288,
          lineRule: LineRuleType.AUTO,
        },
      },
      run: {
        color: level === 1 ? preset.headings[1].color : preset.palette.muted,
        font: getFontAttributes(preset, bodyOverride.font),
        size: level === 1 ? 21 : level === 2 ? 19 : 18,
      },
    })),
  ];
};

const createNumberingLevels = (preset: WordDocumentPreset, ordered: boolean) =>
  Array.from({ length: 5 }, (_, level) => ({
    alignment: AlignmentType.START,
    format: ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
    level,
    style: {
      paragraph: {
        indent: {
          hanging: preset.list.hanging,
          left: preset.list.textIndent + level * 360,
        },
        spacing: {
          after: toTwips(preset.list.after),
          line: Math.round(preset.body.lineSpacing * 240),
          lineRule: LineRuleType.AUTO,
        },
      },
      run: { color: preset.palette.accent, font: getFontAttributes(preset) },
    },
    text: ordered
      ? `${Array.from({ length: level + 1 }, (_, index) => `%${index + 1}`).join(".")}.`
      : "•",
  }));

const createHeadingNumberingLevels = (preset: WordDocumentPreset, chinese: boolean) =>
  Array.from({ length: 3 }, (_, level) => ({
    alignment: AlignmentType.START,
    format: LevelFormat.DECIMAL,
    level,
    style: {
      paragraph: {
        indent: { hanging: level === 0 ? 520 : 430, left: level === 0 ? 520 : 430 },
      },
      run: {
        bold: preset.headings[(level + 1) as 1 | 2 | 3].bold,
        color: preset.headings[(level + 1) as 1 | 2 | 3].color,
        font: getFontAttributes(preset),
      },
    },
    text:
      preset.headingNumbering === "legal" && chinese
        ? level === 0
          ? "第%1条"
          : Array.from({ length: level + 1 }, (_, index) => `%${index + 1}`).join(".")
        : `${Array.from({ length: level + 1 }, (_, index) => `%${index + 1}`).join(".")}.`,
  }));

const createMetadataTable = (job: WordDocumentJob, preset: WordDocumentPreset) => {
  const rows = job.metadata || [];
  const labelWidth = Math.min(1900, Math.round(preset.table.width * 0.23));
  const valueWidth = preset.table.width - labelWidth;
  const noBorder = { color: "FFFFFF", size: 0, style: BorderStyle.NIL };
  return new Table({
    borders: {
      bottom: noBorder,
      insideHorizontal: noBorder,
      insideVertical: noBorder,
      left: noBorder,
      right: noBorder,
      top: noBorder,
    },
    columnWidths: [labelWidth, valueWidth],
    indent: { size: preset.table.indent, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    margins: { bottom: 50, left: 80, right: 80, top: 50 },
    rows: rows.map(
      (item) =>
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ bold: true, text: item.label })],
                  style: "MarkAIMetadata",
                }),
              ],
              shading:
                preset.opening.layout === "meeting"
                  ? { fill: preset.palette.subtleFill, type: ShadingType.CLEAR }
                  : undefined,
              verticalAlign: VerticalAlignTable.CENTER,
              width: { size: labelWidth, type: WidthType.DXA },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: item.value })],
                  style: "MarkAIMetadata",
                }),
              ],
              shading:
                preset.opening.layout === "meeting"
                  ? { fill: preset.palette.subtleFill, type: ShadingType.CLEAR }
                  : undefined,
              verticalAlign: VerticalAlignTable.CENTER,
              width: { size: valueWidth, type: WidthType.DXA },
            }),
          ],
        }),
    ),
    width: { size: preset.table.width, type: WidthType.DXA },
  });
};

const createOpeningChildren = (job: WordDocumentJob, preset: WordDocumentPreset) => {
  const children: Array<Paragraph | Table> = [];
  if (["cover", "masthead", "meeting"].includes(preset.opening.layout)) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: preset.opening.label })],
        style: "MarkAIKicker",
      }),
    );
  }
  children.push(
    new Paragraph({
      children: [new TextRun({ text: job.title })],
      style: "MarkAITitle",
    }),
  );
  if (job.subtitle) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: job.subtitle })],
        style: "MarkAISubtitle",
      }),
    );
  }
  if (job.metadata?.length) {
    if (preset.opening.layout === "meeting" || preset.opening.layout === "masthead") {
      children.push(createMetadataTable(job, preset));
    } else {
      const separator = preset.opening.layout === "resume" ? "  |  " : "：";
      const values =
        preset.opening.layout === "resume"
          ? [job.metadata.map((item) => `${item.label}${separator}${item.value}`).join("    ")]
          : job.metadata.map((item) => `${item.label}${separator}${item.value}`);
      children.push(
        ...values.map(
          (value) =>
            new Paragraph({ children: [new TextRun({ text: value })], style: "MarkAIMetadata" }),
        ),
      );
    }
  }
  if (preset.opening.pageBreakAfter) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }
  return children;
};

export const renderWordDocument = async (job: WordDocumentJob) => {
  const preset = getWordDocumentPreset(job.documentType || job.preset);
  const allTextOverride = getStyleOverride(job, "all-text");
  const bodyOverride = getStyleOverride(job, "body");
  const body = applyTextStyleOverride(preset.body, bodyOverride);
  const chinese = /[\u3400-\u9fff]/.test(`${job.title}${job.subtitle || ""}`);
  const hasFeature = (feature: WordDocumentJob["features"][number]) =>
    job.features.includes(feature);
  const header = hasFeature("header")
    ? new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: {
              bottom: {
                color: preset.palette.border,
                size: 4,
                space: 4,
                style: BorderStyle.SINGLE,
              },
            },
            children: [
              new TextRun({
                color: allTextOverride.color || preset.palette.muted,
                font: getFontAttributes(preset, allTextOverride.font),
                size: 17,
                text: `${preset.opening.label} · ${job.title}`.slice(0, 72),
              }),
            ],
            spacing: { after: 0 },
          }),
        ],
      })
    : undefined;
  const footer = hasFeature("page-number")
    ? new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                children: chinese
                  ? ["第 ", PageNumber.CURRENT, " 页"]
                  : ["Page ", PageNumber.CURRENT],
                color: allTextOverride.color || preset.palette.muted,
                font: getFontAttributes(preset, allTextOverride.font),
                size: 17,
              }),
            ],
          }),
        ],
      })
    : undefined;

  const document = new Document({
    numbering: {
      config: [
        {
          levels: createNumberingLevels(preset, true),
          reference: "markai-numbering",
        },
        {
          levels: createNumberingLevels(preset, false),
          reference: "markai-bullets",
        },
        ...(preset.headingNumbering === "none"
          ? []
          : [
              {
                levels: createHeadingNumberingLevels(preset, chinese),
                reference: "markai-headings",
              },
            ]),
      ],
    },
    sections: [
      {
        children: [
          ...createOpeningChildren(job, preset),
          ...(hasFeature("table-of-contents") ? createTableOfContents(job) : []),
          ...createBlockChildren(job, preset),
        ],
        footers: footer ? { default: footer } : undefined,
        headers: header ? { default: header } : undefined,
        properties: {
          page: {
            margin: {
              ...preset.page.margins,
              footer: preset.page.footerDistance,
              header: preset.page.headerDistance,
            },
            size: {
              height: preset.page.height,
              orientation: PageOrientation.PORTRAIT,
              width: preset.page.width,
            },
          },
        },
      },
    ],
    styles: {
      default: {
        document: {
          paragraph: styleParagraph(body, preset.body.firstLineIndentChars),
          run: {
            color: body.color,
            font: getFontAttributes(preset, bodyOverride.font),
            size: body.size * 2,
          },
        },
      },
      paragraphStyles: createParagraphStyles(job, preset),
    },
  });

  return new Uint8Array(await Packer.toBuffer(document));
};
