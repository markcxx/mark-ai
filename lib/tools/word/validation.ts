import {
  WORD_DOCUMENT_PRESETS,
  WORD_DOCUMENT_STYLE_SCOPES,
  WORD_DOCUMENT_TYPES,
  type WordDocumentBlock,
  type WordDocumentFeature,
  type WordDocumentMetadataItem,
  type WordDocumentPresetId,
  type WordDocumentStyleScope,
  type WordDocumentTextStyleOverride,
  type WordDocumentType,
  type WordOutlineItem,
  type WordParagraphFormat,
  type WordTextRun,
} from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const requiredString = (value: unknown, label: string, maxLength: number) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}不能为空`);
  if (value.length > maxLength) throw new Error(`${label}过长`);
  return value.trim();
};

const optionalNumber = (value: unknown, label: string, minimum: number, maximum: number) => {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label}必须在 ${minimum} 到 ${maximum} 之间`);
  }
  return value;
};

const parseFormat = (value: unknown): WordParagraphFormat | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("段落格式无效");
  const alignment = value.alignment;
  if (
    alignment !== undefined &&
    !["center", "justified", "left", "right"].includes(String(alignment))
  ) {
    throw new Error("段落对齐方式无效");
  }
  return {
    alignment: alignment as WordParagraphFormat["alignment"],
    firstLineIndentChars: optionalNumber(value.firstLineIndentChars, "首行缩进", 0, 4),
    keepNext: typeof value.keepNext === "boolean" ? value.keepNext : undefined,
    lineSpacing: optionalNumber(value.lineSpacing, "行距", 1, 3),
    spacingAfter: optionalNumber(value.spacingAfter, "段后间距", 0, 72),
    spacingBefore: optionalNumber(value.spacingBefore, "段前间距", 0, 72),
  };
};

const parseRuns = (value: unknown): WordTextRun[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error("文字片段必须是 1 到 100 项的数组");
  }
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 个文字片段无效`);
    const highlight = item.highlight;
    if (
      highlight !== undefined &&
      !["cyan", "green", "lightGray", "magenta", "red", "yellow"].includes(String(highlight))
    ) {
      throw new Error(`第 ${index + 1} 个文字片段的高亮颜色无效`);
    }
    const color = item.color;
    if (color !== undefined && (typeof color !== "string" || !/^#?[0-9a-f]{6}$/i.test(color))) {
      throw new Error(`第 ${index + 1} 个文字片段的颜色必须是六位十六进制颜色`);
    }
    return {
      bold: typeof item.bold === "boolean" ? item.bold : undefined,
      color: typeof color === "string" ? color.replace(/^#/, "").toUpperCase() : undefined,
      font: typeof item.font === "string" ? item.font.slice(0, 80) : undefined,
      highlight: highlight as WordTextRun["highlight"],
      italics: typeof item.italics === "boolean" ? item.italics : undefined,
      size: optionalNumber(item.size, "字号", 8, 16),
      strike: typeof item.strike === "boolean" ? item.strike : undefined,
      text: requiredString(item.text, `第 ${index + 1} 个文字片段`, 10_000),
      underline: typeof item.underline === "boolean" ? item.underline : undefined,
    };
  });
};

export const parseWordDocumentPreset = (value: unknown): WordDocumentPresetId => {
  if (WORD_DOCUMENT_PRESETS.includes(value as WordDocumentPresetId)) {
    return value as WordDocumentPresetId;
  }
  throw new Error("Word 排版预设无效");
};

export const parseWordDocumentType = (value: unknown): WordDocumentType => {
  if (WORD_DOCUMENT_TYPES.includes(value as WordDocumentType)) {
    return value as WordDocumentType;
  }
  throw new Error("Word 文档类型无效");
};

export const parseWordMetadata = (value: unknown): WordDocumentMetadataItem[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) throw new Error("文档元数据最多包含 8 项");
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 个文档元数据项无效`);
    return {
      label: requiredString(item.label, `第 ${index + 1} 个元数据标签`, 40),
      value: requiredString(item.value, `第 ${index + 1} 个元数据值`, 300),
    };
  });
};

export const parseWordDocumentStyleScope = (value: unknown): WordDocumentStyleScope => {
  if (WORD_DOCUMENT_STYLE_SCOPES.includes(value as WordDocumentStyleScope)) {
    return value as WordDocumentStyleScope;
  }
  throw new Error("Word 样式修改范围无效");
};

export const parseWordDocumentTextStyleOverride = (
  value: Record<string, unknown>,
): WordDocumentTextStyleOverride => {
  const color = value.color;
  if (color !== undefined && (typeof color !== "string" || !/^#?[0-9a-f]{6}$/i.test(color))) {
    throw new Error("字体颜色必须是六位十六进制颜色");
  }
  const font = value.font;
  if (font !== undefined && (typeof font !== "string" || !font.trim() || font.length > 80)) {
    throw new Error("字体名称无效");
  }
  const size = optionalNumber(value.size, "字号", 8, 32);
  const override = {
    color: typeof color === "string" ? color.replace(/^#/, "").toUpperCase() : undefined,
    font: typeof font === "string" ? font.trim() : undefined,
    size,
  };
  if (override.color === undefined && override.font === undefined && override.size === undefined) {
    throw new Error("请至少提供颜色、字体或字号中的一项");
  }
  return override;
};

export const parseWordFeatures = (
  value: unknown,
  defaults: WordDocumentFeature[] = ["header", "page-number"],
): WordDocumentFeature[] => {
  if (value === undefined) return [...defaults];
  if (!Array.isArray(value) || value.length > 3) throw new Error("文档功能配置无效");
  const allowed = new Set<WordDocumentFeature>(["header", "page-number", "table-of-contents"]);
  const invalid = value.find(
    (item) => typeof item !== "string" || !allowed.has(item as WordDocumentFeature),
  );
  if (invalid !== undefined) throw new Error(`不支持的 Word 文档功能：${String(invalid)}`);
  const features = value as WordDocumentFeature[];
  return [...new Set(features)];
};

export const parseWordOutline = (value: unknown): WordOutlineItem[] => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 8) {
    throw new Error("目录必须包含 1 到 8 个章节；请合并过细的相邻小节");
  }
  const ids = new Set<string>();
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 个目录项无效`);
    const id = requiredString(item.id, `第 ${index + 1} 个目录项 ID`, 40);
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`目录项 ID ${id} 格式无效`);
    if (ids.has(id)) throw new Error(`目录项 ID ${id} 重复`);
    ids.add(id);
    const level = Number(item.level);
    if (![1, 2, 3].includes(level)) throw new Error(`目录项 ${id} 的层级必须为 1、2 或 3`);
    return {
      id,
      level: level as 1 | 2 | 3,
      title: requiredString(item.title, `目录项 ${id} 标题`, 160),
    };
  });
};

export const parseWordBlock = (value: unknown): WordDocumentBlock => {
  if (!isRecord(value)) throw new Error("文档块无效");
  const id = requiredString(value.id, "文档块 ID", 60);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`文档块 ID ${id} 格式无效`);
  const format = parseFormat(value.format);
  const type = value.type;

  if (type === "heading") {
    const level = Number(value.level);
    if (![1, 2, 3].includes(level)) throw new Error("标题层级必须为 1、2 或 3");
    return {
      format,
      id,
      level: level as 1 | 2 | 3,
      text: requiredString(value.text, "标题文字", 300),
      type,
    };
  }
  if (type === "paragraph" || type === "quote") {
    const text = typeof value.text === "string" ? value.text.trim() : undefined;
    const runs = parseRuns(value.runs);
    if (!text && !runs)
      throw new Error(`${type === "quote" ? "引用" : "段落"}必须包含 text 或 runs`);
    if (text && text.length > 20_000) throw new Error("段落文字过长");
    if (type === "quote") return { format, id, runs, text, type };
    const style = value.style;
    if (style !== undefined && !["body", "caption", "note"].includes(String(style))) {
      throw new Error("段落样式无效");
    }
    return {
      format,
      id,
      runs,
      style: style as "body" | "caption" | "note" | undefined,
      text,
      type,
    };
  }
  if (type === "list") {
    if (!Array.isArray(value.items) || value.items.length === 0 || value.items.length > 100) {
      throw new Error("列表必须包含 1 到 100 项");
    }
    const items = value.items.map((item, index) =>
      requiredString(item, `列表第 ${index + 1} 项`, 2000),
    );
    const level = optionalNumber(value.level, "列表层级", 0, 4);
    return {
      format,
      id,
      items,
      level,
      ordered: typeof value.ordered === "boolean" ? value.ordered : false,
      type,
    };
  }
  if (type === "table") {
    if (!Array.isArray(value.rows) || value.rows.length === 0 || value.rows.length > 100) {
      throw new Error("表格必须包含 1 到 100 行");
    }
    const rows = value.rows.map((row, rowIndex) => {
      if (!Array.isArray(row) || row.length === 0 || row.length > 20) {
        throw new Error(`表格第 ${rowIndex + 1} 行必须包含 1 到 20 列`);
      }
      return row.map((cell, columnIndex) => {
        if (typeof cell !== "string" || cell.length > 5000) {
          throw new Error(`表格第 ${rowIndex + 1} 行第 ${columnIndex + 1} 列内容无效`);
        }
        return cell.trim();
      });
    });
    return {
      format,
      header: typeof value.header === "boolean" ? value.header : true,
      id,
      rows,
      type,
    };
  }
  if (type === "page-break") return { format, id, type };
  throw new Error(`不支持的文档块类型：${String(type)}`);
};

export const parseWordBlocks = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) {
    throw new Error("每一步必须提交 1 到 40 个文档块");
  }
  const blocks = value.map(parseWordBlock);
  if (new Set(blocks.map((block) => block.id)).size !== blocks.length) {
    throw new Error("同一步骤中的文档块 ID 不能重复");
  }
  return blocks;
};

export const parseRequiredString = requiredString;
