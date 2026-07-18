import type { BuiltinToolDefinition } from "./types";

const WORD_TOOL: BuiltinToolDefinition = {
  accent: "blue",
  category: "documents",
  description: "把结构化内容整理为排版清晰的 Word 文档，适合报告、方案、纪要与正式材料。",
  features: ["DOCX 原生文件", "标题与段落层级", "列表和基础排版"],
  functions: [
    {
      description:
        "Create a downloadable Microsoft Word DOCX document. Use it when the user explicitly asks for a Word file, DOCX file, report, proposal, meeting notes, or another document that should be delivered as an editable Word file.",
      name: "create_word_document",
      parameters: {
        additionalProperties: false,
        properties: {
          content: {
            description:
              "The complete document content in Markdown. Use # headings, paragraphs, bullet lists, and numbered lists to express structure.",
            maxLength: 60000,
            type: "string",
          },
          filename: {
            description: "Output filename without a path. The .docx extension is optional.",
            maxLength: 100,
            type: "string",
          },
          title: {
            description: "Document title shown at the top of the Word file.",
            maxLength: 160,
            type: "string",
          },
        },
        required: ["title", "content"],
        type: "object",
      },
    },
  ],
  id: "word-document",
  kind: "tool",
  name: "Word 文档生成",
  shortName: "Word",
  status: "available",
  version: "1.0.0",
};

const EXCEL_TOOL: BuiltinToolDefinition = {
  accent: "emerald",
  category: "documents",
  description: "将数据整理为可继续编辑的 Excel 工作簿，支持多个工作表和自动列宽。",
  features: ["XLSX 原生文件", "多工作表", "自动列宽与表头"],
  functions: [
    {
      description:
        "Create a downloadable Excel XLSX workbook. Use it when the user asks for a spreadsheet, data table, workbook, checklist, budget, schedule, or any result that should be delivered as an editable Excel file.",
      name: "create_excel_workbook",
      parameters: {
        additionalProperties: false,
        properties: {
          filename: {
            description: "Output filename without a path. The .xlsx extension is optional.",
            maxLength: 100,
            type: "string",
          },
          sheets: {
            description:
              "Workbook sheets. The first row should normally contain column headers. Keep the data concise and directly usable.",
            items: {
              additionalProperties: false,
              properties: {
                name: {
                  description: "Worksheet name, at most 31 characters.",
                  maxLength: 31,
                  type: "string",
                },
                rows: {
                  description: "Two-dimensional array of cell values.",
                  items: {
                    items: { type: "string" },
                    maxItems: 50,
                    type: "array",
                  },
                  maxItems: 1000,
                  type: "array",
                },
              },
              required: ["name", "rows"],
              type: "object",
            },
            maxItems: 10,
            type: "array",
          },
        },
        required: ["sheets"],
        type: "object",
      },
    },
  ],
  id: "excel-workbook",
  kind: "tool",
  name: "Excel 表格生成",
  shortName: "Excel",
  status: "available",
  version: "1.0.0",
};

const PDF_TOOL: BuiltinToolDefinition = {
  accent: "amber",
  category: "documents",
  description: "将内容转换为适合交付和打印的 PDF。渲染方案确认后接入执行能力。",
  features: ["HTML/CSS 排版", "分页与打印样式", "中文字体嵌入"],
  functions: [],
  id: "pdf-document",
  kind: "tool",
  name: "PDF 文档生成",
  shortName: "PDF",
  status: "planned",
  version: "0.1.0",
};

const ARTIFACTS_SKILL: BuiltinToolDefinition = {
  accent: "violet",
  category: "creation",
  description: "创建可直接预览和下载的网页、组件、信息面板与交互式原型。",
  features: ["HTML 实时预览", "响应式界面", "一键下载源文件"],
  functions: [],
  id: "artifacts",
  kind: "skill",
  name: "Artifacts",
  shortName: "Artifacts",
  status: "available",
  systemPrompt: `Artifacts skill is enabled for this conversation.
When the user asks to create a webpage, landing page, dashboard, interactive demo, visual component, poster-like web composition, or another browser-renderable artifact:
- Produce a complete, self-contained HTML document in a fenced \`\`\`html code block.
- Include a meaningful <title> element.
- Put CSS and JavaScript inside the document; do not require a build step.
- Prefer responsive, polished layouts with accessible contrast and sensible empty states.
- Do not use external scripts, external stylesheets, remote fonts, or network requests unless the user explicitly requests them.
- Keep explanatory prose brief so the HTML preview remains the primary result.
The application will turn HTML code blocks into a safe preview panel and provide an HTML download action.`,
  version: "1.0.0",
};

export const BUILTIN_TOOLS = [WORD_TOOL, EXCEL_TOOL, PDF_TOOL, ARTIFACTS_SKILL] as const;

export const getBuiltinTool = (id: string) => BUILTIN_TOOLS.find((tool) => tool.id === id);

export const getAvailableBuiltinTool = (id: string) => {
  const tool = getBuiltinTool(id);
  return tool?.status === "available" ? tool : undefined;
};

export const getToolFunctions = (toolIds: string[]) =>
  toolIds.flatMap((id) => getAvailableBuiltinTool(id)?.functions || []);

export const getBuiltinToolByFunction = (name: string) =>
  BUILTIN_TOOLS.find((tool) => tool.functions.some((toolFunction) => toolFunction.name === name));

export const getToolSystemPrompt = (toolIds: string[]) =>
  toolIds
    .map((id) => getAvailableBuiltinTool(id)?.systemPrompt)
    .filter((prompt): prompt is string => Boolean(prompt))
    .join("\n\n");
