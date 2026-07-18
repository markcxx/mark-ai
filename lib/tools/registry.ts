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

const DATA_VISUALIZATION_SKILL: BuiltinToolDefinition = {
  accent: "violet",
  category: "creation",
  description: "把对话或附件中的数据转换为可交互图表，并直接在聊天消息中渲染。",
  features: ["ECharts 交互图表", "多种可视化类型", "PNG 图片导出"],
  functions: [],
  id: "data-visualization",
  kind: "skill",
  name: "数据可视化",
  shortName: "可视化",
  status: "available",
  systemPrompt: `Data visualization skill is enabled for this conversation.
When a chart materially improves the answer, analyze the data first and then output one or more Apache ECharts option objects inside fenced \`\`\`echarts code blocks.
- The block content must be strict JSON: no JavaScript, functions, comments, trailing commas, Markdown, or HTML.
- Output the ECharts option object directly, not wrapped in another property.
- Always include a non-empty series array and a concise title.text.
- Choose an appropriate built-in chart such as line, bar, pie, scatter, radar, heatmap, funnel, gauge, treemap, sunburst, sankey, graph, candlestick, or boxplot.
- Use clear Chinese labels when the conversation is Chinese. Include tooltip and legend when helpful.
- Prefer accurate, readable charts over decorative complexity. Aggregate excessive categories or data points before charting.
- Never invent missing data. Briefly state important conclusions outside the chart block.
The application renders these JSON blocks as interactive charts directly in the chat.`,
  version: "1.0.0",
};

export const BUILTIN_TOOLS = [WORD_TOOL, EXCEL_TOOL, DATA_VISUALIZATION_SKILL] as const;

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
