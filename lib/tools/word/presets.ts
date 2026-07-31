import {
  resolveWordDocumentType,
  type WordDocumentFeature,
  type WordDocumentPresetId,
  type WordDocumentType,
} from "./types";

type AlignmentToken = "center" | "justified" | "left" | "right";

export type WordTextStyleToken = {
  after: number;
  alignment: AlignmentToken;
  before: number;
  bold?: boolean;
  color: string;
  lineSpacing: number;
  size: number;
};

export type WordDocumentPreset = {
  body: WordTextStyleToken & { firstLineIndentChars: number };
  defaultFeatures: WordDocumentFeature[];
  documentType: WordDocumentType;
  font: { eastAsia: string; latin: string };
  headingNumbering: "decimal" | "legal" | "none";
  headings: Record<1 | 2 | 3, WordTextStyleToken>;
  list: {
    after: number;
    hanging: number;
    markerAlignment: number;
    textIndent: number;
  };
  name: string;
  opening: {
    label: string;
    layout: "cover" | "legal" | "masthead" | "meeting" | "notice" | "resume" | "standard";
    pageBreakAfter: boolean;
  };
  page: {
    footerDistance: number;
    headerDistance: number;
    height: number;
    margins: { bottom: number; left: number; right: number; top: number };
    width: number;
  };
  palette: {
    accent: string;
    border: string;
    calloutFill: string;
    muted: string;
    subtleFill: string;
  };
  table: {
    alternateRows: boolean;
    alternateRowFill: string;
    bodyFontSize: number;
    cellMargins: { bottom: number; left: number; right: number; top: number };
    headerFill: string;
    headerTextColor: string;
    indent: number;
    style: "accent" | "grid" | "minimal";
    width: number;
  };
  title: WordTextStyleToken & { rule: boolean; ruleColor: string };
};

const LETTER_PAGE = {
  footerDistance: 708,
  headerDistance: 708,
  height: 15_840,
  margins: { bottom: 1440, left: 1440, right: 1440, top: 1440 },
  width: 12_240,
} as const;

const TABLE_GEOMETRY = {
  bodyFontSize: 9.5,
  cellMargins: { bottom: 90, left: 120, right: 120, top: 90 },
  indent: 120,
  width: 9360,
} as const;

const PRESETS: Record<WordDocumentType, WordDocumentPreset> = {
  "academic-paper": {
    body: {
      after: 6,
      alignment: "justified",
      before: 0,
      color: "161616",
      firstLineIndentChars: 2,
      lineSpacing: 1.3,
      size: 10.5,
    },
    defaultFeatures: ["page-number"],
    documentType: "academic-paper",
    font: { eastAsia: "Arial Unicode MS", latin: "Times New Roman" },
    headingNumbering: "decimal",
    headings: {
      1: {
        after: 8,
        alignment: "left",
        before: 16,
        bold: true,
        color: "111111",
        lineSpacing: 1.15,
        size: 15,
      },
      2: {
        after: 6,
        alignment: "left",
        before: 12,
        bold: true,
        color: "222222",
        lineSpacing: 1.15,
        size: 12.5,
      },
      3: {
        after: 4,
        alignment: "left",
        before: 8,
        bold: true,
        color: "333333",
        lineSpacing: 1.15,
        size: 11.5,
      },
    },
    list: { after: 4, hanging: 360, markerAlignment: 360, textIndent: 720 },
    name: "学术论文",
    opening: { label: "学术论文", layout: "standard", pageBreakAfter: false },
    page: LETTER_PAGE,
    palette: {
      accent: "303030",
      border: "B9B9B9",
      calloutFill: "F5F5F5",
      muted: "666666",
      subtleFill: "FAFAFA",
    },
    table: {
      ...TABLE_GEOMETRY,
      alternateRows: false,
      alternateRowFill: "FFFFFF",
      headerFill: "ECECEC",
      headerTextColor: "111111",
      style: "minimal",
    },
    title: {
      after: 8,
      alignment: "center",
      before: 0,
      bold: true,
      color: "111111",
      lineSpacing: 1.1,
      rule: false,
      ruleColor: "FFFFFF",
      size: 20,
    },
  },
  "business-proposal": {
    body: {
      after: 8,
      alignment: "justified",
      before: 0,
      color: "24313D",
      firstLineIndentChars: 0,
      lineSpacing: 1.3,
      size: 11,
    },
    defaultFeatures: ["header", "page-number", "table-of-contents"],
    documentType: "business-proposal",
    font: { eastAsia: "Arial Unicode MS", latin: "Arial" },
    headingNumbering: "none",
    headings: {
      1: {
        after: 10,
        alignment: "left",
        before: 18,
        bold: true,
        color: "174F62",
        lineSpacing: 1.15,
        size: 17,
      },
      2: {
        after: 7,
        alignment: "left",
        before: 14,
        bold: true,
        color: "216A7D",
        lineSpacing: 1.15,
        size: 14,
      },
      3: {
        after: 5,
        alignment: "left",
        before: 10,
        bold: true,
        color: "80611A",
        lineSpacing: 1.15,
        size: 12,
      },
    },
    list: { after: 5, hanging: 280, markerAlignment: 260, textIndent: 540 },
    name: "商务方案",
    opening: { label: "商务方案", layout: "cover", pageBreakAfter: true },
    page: LETTER_PAGE,
    palette: {
      accent: "C28B25",
      border: "B9CCD3",
      calloutFill: "F4F8F8",
      muted: "60717B",
      subtleFill: "F7FAFA",
    },
    table: {
      ...TABLE_GEOMETRY,
      alternateRows: true,
      alternateRowFill: "F5F9F9",
      headerFill: "174F62",
      headerTextColor: "FFFFFF",
      style: "accent",
    },
    title: {
      after: 8,
      alignment: "center",
      before: 72,
      bold: true,
      color: "173F4D",
      lineSpacing: 1.05,
      rule: false,
      ruleColor: "FFFFFF",
      size: 30,
    },
  },
  contract: {
    body: {
      after: 5,
      alignment: "justified",
      before: 0,
      color: "111111",
      firstLineIndentChars: 2,
      lineSpacing: 1.25,
      size: 10.5,
    },
    defaultFeatures: ["page-number"],
    documentType: "contract",
    font: { eastAsia: "Arial Unicode MS", latin: "Times New Roman" },
    headingNumbering: "legal",
    headings: {
      1: {
        after: 5,
        alignment: "left",
        before: 10,
        bold: true,
        color: "111111",
        lineSpacing: 1.2,
        size: 12.5,
      },
      2: {
        after: 4,
        alignment: "left",
        before: 8,
        bold: true,
        color: "202020",
        lineSpacing: 1.2,
        size: 11.5,
      },
      3: {
        after: 3,
        alignment: "left",
        before: 6,
        bold: false,
        color: "303030",
        lineSpacing: 1.2,
        size: 10.5,
      },
    },
    list: { after: 3, hanging: 360, markerAlignment: 360, textIndent: 720 },
    name: "合同协议",
    opening: { label: "合同协议", layout: "legal", pageBreakAfter: false },
    page: LETTER_PAGE,
    palette: {
      accent: "333333",
      border: "AFAFAF",
      calloutFill: "F5F5F5",
      muted: "666666",
      subtleFill: "FAFAFA",
    },
    table: {
      ...TABLE_GEOMETRY,
      alternateRows: false,
      alternateRowFill: "FFFFFF",
      headerFill: "E8E8E8",
      headerTextColor: "111111",
      style: "grid",
    },
    title: {
      after: 18,
      alignment: "center",
      before: 0,
      bold: true,
      color: "111111",
      lineSpacing: 1.1,
      rule: false,
      ruleColor: "FFFFFF",
      size: 22,
    },
  },
  "formal-report": {
    body: {
      after: 7,
      alignment: "justified",
      before: 0,
      color: "20252B",
      firstLineIndentChars: 2,
      lineSpacing: 1.25,
      size: 11,
    },
    defaultFeatures: ["header", "page-number"],
    documentType: "formal-report",
    font: { eastAsia: "Arial Unicode MS", latin: "Arial" },
    headingNumbering: "none",
    headings: {
      1: {
        after: 8,
        alignment: "left",
        before: 16,
        bold: true,
        color: "24557A",
        lineSpacing: 1.15,
        size: 16,
      },
      2: {
        after: 6,
        alignment: "left",
        before: 12,
        bold: true,
        color: "2E668F",
        lineSpacing: 1.15,
        size: 13,
      },
      3: {
        after: 4,
        alignment: "left",
        before: 8,
        bold: true,
        color: "3B556A",
        lineSpacing: 1.15,
        size: 12,
      },
    },
    list: { after: 4, hanging: 360, markerAlignment: 360, textIndent: 720 },
    name: "中文正式报告",
    opening: { label: "正式报告", layout: "standard", pageBreakAfter: false },
    page: LETTER_PAGE,
    palette: {
      accent: "24557A",
      border: "C9D5DF",
      calloutFill: "F2F6F8",
      muted: "667785",
      subtleFill: "F7F9FA",
    },
    table: {
      ...TABLE_GEOMETRY,
      alternateRows: true,
      alternateRowFill: "F7F9FA",
      headerFill: "E5EEF4",
      headerTextColor: "244B68",
      style: "grid",
    },
    title: {
      after: 14,
      alignment: "center",
      before: 0,
      bold: true,
      color: "172B3A",
      lineSpacing: 1.1,
      rule: true,
      ruleColor: "B8CBD8",
      size: 24,
    },
  },
  "general-clean": {
    body: {
      after: 6,
      alignment: "left",
      before: 0,
      color: "1F2937",
      firstLineIndentChars: 0,
      lineSpacing: 1.1,
      size: 11,
    },
    defaultFeatures: ["header", "page-number"],
    documentType: "general-clean",
    font: { eastAsia: "Arial Unicode MS", latin: "Arial" },
    headingNumbering: "none",
    headings: {
      1: {
        after: 8,
        alignment: "left",
        before: 16,
        bold: true,
        color: "2E5F8A",
        lineSpacing: 1.15,
        size: 16,
      },
      2: {
        after: 6,
        alignment: "left",
        before: 12,
        bold: true,
        color: "2E5F8A",
        lineSpacing: 1.15,
        size: 13,
      },
      3: {
        after: 4,
        alignment: "left",
        before: 8,
        bold: true,
        color: "1F4D78",
        lineSpacing: 1.15,
        size: 12,
      },
    },
    list: { after: 4, hanging: 360, markerAlignment: 360, textIndent: 720 },
    name: "通用简洁",
    opening: { label: "文档", layout: "standard", pageBreakAfter: false },
    page: LETTER_PAGE,
    palette: {
      accent: "2E5F8A",
      border: "CBD5E1",
      calloutFill: "F4F6F9",
      muted: "64748B",
      subtleFill: "F8FAFC",
    },
    table: {
      ...TABLE_GEOMETRY,
      alternateRows: true,
      alternateRowFill: "F8FAFC",
      headerFill: "E8EEF5",
      headerTextColor: "1F4D78",
      style: "grid",
    },
    title: {
      after: 12,
      alignment: "left",
      before: 0,
      bold: true,
      color: "172033",
      lineSpacing: 1.05,
      rule: true,
      ruleColor: "2E5F8A",
      size: 24,
    },
  },
  "meeting-minutes": {
    body: {
      after: 5,
      alignment: "left",
      before: 0,
      color: "263238",
      firstLineIndentChars: 0,
      lineSpacing: 1.15,
      size: 10.5,
    },
    defaultFeatures: ["header", "page-number"],
    documentType: "meeting-minutes",
    font: { eastAsia: "Arial Unicode MS", latin: "Arial" },
    headingNumbering: "none",
    headings: {
      1: {
        after: 7,
        alignment: "left",
        before: 14,
        bold: true,
        color: "176B75",
        lineSpacing: 1.1,
        size: 15,
      },
      2: {
        after: 5,
        alignment: "left",
        before: 10,
        bold: true,
        color: "2B7D86",
        lineSpacing: 1.1,
        size: 12.5,
      },
      3: {
        after: 4,
        alignment: "left",
        before: 8,
        bold: true,
        color: "7A5A00",
        lineSpacing: 1.1,
        size: 11.5,
      },
    },
    list: { after: 3, hanging: 280, markerAlignment: 260, textIndent: 540 },
    name: "会议纪要",
    opening: { label: "会议纪要", layout: "meeting", pageBreakAfter: false },
    page: LETTER_PAGE,
    palette: {
      accent: "C58B1B",
      border: "BFD3D5",
      calloutFill: "F2F8F8",
      muted: "617277",
      subtleFill: "F7FAFA",
    },
    table: {
      ...TABLE_GEOMETRY,
      alternateRows: true,
      alternateRowFill: "F5F9F9",
      headerFill: "176B75",
      headerTextColor: "FFFFFF",
      style: "accent",
    },
    title: {
      after: 8,
      alignment: "left",
      before: 0,
      bold: true,
      color: "164E55",
      lineSpacing: 1.05,
      rule: true,
      ruleColor: "C58B1B",
      size: 23,
    },
  },
  "official-notice": {
    body: {
      after: 7,
      alignment: "justified",
      before: 0,
      color: "151515",
      firstLineIndentChars: 2,
      lineSpacing: 1.3,
      size: 11,
    },
    defaultFeatures: ["page-number"],
    documentType: "official-notice",
    font: { eastAsia: "Arial Unicode MS", latin: "Arial" },
    headingNumbering: "none",
    headings: {
      1: {
        after: 7,
        alignment: "left",
        before: 14,
        bold: true,
        color: "1A1A1A",
        lineSpacing: 1.2,
        size: 15,
      },
      2: {
        after: 5,
        alignment: "left",
        before: 10,
        bold: true,
        color: "262626",
        lineSpacing: 1.2,
        size: 12.5,
      },
      3: {
        after: 4,
        alignment: "left",
        before: 8,
        bold: true,
        color: "3A3A3A",
        lineSpacing: 1.2,
        size: 11.5,
      },
    },
    list: { after: 4, hanging: 360, markerAlignment: 360, textIndent: 720 },
    name: "通知公文",
    opening: { label: "通知", layout: "notice", pageBreakAfter: false },
    page: LETTER_PAGE,
    palette: {
      accent: "9B1C1C",
      border: "C9C9C9",
      calloutFill: "F8F5F5",
      muted: "666666",
      subtleFill: "FAFAFA",
    },
    table: {
      ...TABLE_GEOMETRY,
      alternateRows: false,
      alternateRowFill: "FFFFFF",
      headerFill: "EFEFEF",
      headerTextColor: "1A1A1A",
      style: "grid",
    },
    title: {
      after: 16,
      alignment: "center",
      before: 0,
      bold: true,
      color: "9B1C1C",
      lineSpacing: 1.1,
      rule: false,
      ruleColor: "FFFFFF",
      size: 22,
    },
  },
  "operations-manual": {
    body: {
      after: 6,
      alignment: "left",
      before: 0,
      color: "26323B",
      firstLineIndentChars: 0,
      lineSpacing: 1.2,
      size: 10.5,
    },
    defaultFeatures: ["header", "page-number", "table-of-contents"],
    documentType: "operations-manual",
    font: { eastAsia: "Arial Unicode MS", latin: "Arial" },
    headingNumbering: "decimal",
    headings: {
      1: {
        after: 9,
        alignment: "left",
        before: 18,
        bold: true,
        color: "174A7E",
        lineSpacing: 1.15,
        size: 17,
      },
      2: {
        after: 7,
        alignment: "left",
        before: 14,
        bold: true,
        color: "24679D",
        lineSpacing: 1.15,
        size: 13.5,
      },
      3: {
        after: 5,
        alignment: "left",
        before: 10,
        bold: true,
        color: "5C6F7E",
        lineSpacing: 1.15,
        size: 11.5,
      },
    },
    list: { after: 4, hanging: 280, markerAlignment: 260, textIndent: 540 },
    name: "操作手册",
    opening: { label: "操作手册", layout: "cover", pageBreakAfter: true },
    page: LETTER_PAGE,
    palette: {
      accent: "E09122",
      border: "C3D2DF",
      calloutFill: "FFF7E8",
      muted: "637482",
      subtleFill: "F5F8FA",
    },
    table: {
      ...TABLE_GEOMETRY,
      alternateRows: true,
      alternateRowFill: "F5F8FA",
      headerFill: "174A7E",
      headerTextColor: "FFFFFF",
      style: "accent",
    },
    title: {
      after: 8,
      alignment: "center",
      before: 78,
      bold: true,
      color: "173F67",
      lineSpacing: 1.05,
      rule: false,
      ruleColor: "FFFFFF",
      size: 28,
    },
  },
  "product-spec": {
    body: {
      after: 5,
      alignment: "left",
      before: 0,
      color: "222536",
      firstLineIndentChars: 0,
      lineSpacing: 1.15,
      size: 10.5,
    },
    defaultFeatures: ["header", "page-number", "table-of-contents"],
    documentType: "product-spec",
    font: { eastAsia: "Arial Unicode MS", latin: "Arial" },
    headingNumbering: "decimal",
    headings: {
      1: {
        after: 8,
        alignment: "left",
        before: 16,
        bold: true,
        color: "4338A0",
        lineSpacing: 1.1,
        size: 16,
      },
      2: {
        after: 6,
        alignment: "left",
        before: 12,
        bold: true,
        color: "5147B8",
        lineSpacing: 1.1,
        size: 13,
      },
      3: {
        after: 4,
        alignment: "left",
        before: 8,
        bold: true,
        color: "555A72",
        lineSpacing: 1.1,
        size: 11.5,
      },
    },
    list: { after: 3, hanging: 280, markerAlignment: 260, textIndent: 540 },
    name: "产品说明书",
    opening: { label: "产品规格", layout: "masthead", pageBreakAfter: false },
    page: LETTER_PAGE,
    palette: {
      accent: "6D5BD0",
      border: "CBC7E8",
      calloutFill: "F5F3FF",
      muted: "6A6D80",
      subtleFill: "F8F7FC",
    },
    table: {
      ...TABLE_GEOMETRY,
      alternateRows: true,
      alternateRowFill: "F8F7FC",
      headerFill: "4338A0",
      headerTextColor: "FFFFFF",
      style: "accent",
    },
    title: {
      after: 8,
      alignment: "left",
      before: 0,
      bold: true,
      color: "302A78",
      lineSpacing: 1.05,
      rule: true,
      ruleColor: "6D5BD0",
      size: 26,
    },
  },
  resume: {
    body: {
      after: 4,
      alignment: "left",
      before: 0,
      color: "263238",
      firstLineIndentChars: 0,
      lineSpacing: 1.08,
      size: 10,
    },
    defaultFeatures: [],
    documentType: "resume",
    font: { eastAsia: "Arial Unicode MS", latin: "Arial" },
    headingNumbering: "none",
    headings: {
      1: {
        after: 5,
        alignment: "left",
        before: 10,
        bold: true,
        color: "0E6B68",
        lineSpacing: 1.05,
        size: 12.5,
      },
      2: {
        after: 4,
        alignment: "left",
        before: 8,
        bold: true,
        color: "334E4D",
        lineSpacing: 1.05,
        size: 11.5,
      },
      3: {
        after: 3,
        alignment: "left",
        before: 6,
        bold: true,
        color: "526260",
        lineSpacing: 1.05,
        size: 10.5,
      },
    },
    list: { after: 2, hanging: 250, markerAlignment: 230, textIndent: 500 },
    name: "个人简历",
    opening: { label: "个人简历", layout: "resume", pageBreakAfter: false },
    page: {
      ...LETTER_PAGE,
      margins: { bottom: 1008, left: 1008, right: 1008, top: 1008 },
    },
    palette: {
      accent: "0E6B68",
      border: "B9D4D2",
      calloutFill: "F0F8F7",
      muted: "60706E",
      subtleFill: "F7FAFA",
    },
    table: {
      ...TABLE_GEOMETRY,
      alternateRows: false,
      alternateRowFill: "FFFFFF",
      headerFill: "E9F4F3",
      headerTextColor: "0E5A57",
      style: "minimal",
      width: 10_224,
    },
    title: {
      after: 3,
      alignment: "left",
      before: 0,
      bold: true,
      color: "123F3D",
      lineSpacing: 1,
      rule: false,
      ruleColor: "FFFFFF",
      size: 28,
    },
  },
};

export const getWordDocumentPreset = (id: WordDocumentPresetId | WordDocumentType) =>
  PRESETS[resolveWordDocumentType(id)];

export const getWordDocumentTypeOptions = () =>
  Object.values(PRESETS).map(({ documentType, name }) => ({ id: documentType, name }));
