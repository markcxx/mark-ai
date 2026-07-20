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
  description: "把对话或附件中的数据转换为可交互的 ECharts 2D/3D 图表。",
  features: ["完整 2D/3D 图表", "多主题切换", "放大查看与 PNG 导出"],
  functions: [],
  id: "data-visualization",
  kind: "skill",
  name: "ECharts 可视化",
  shortName: "ECharts",
  status: "available",
  systemPrompt: `Data visualization skill is enabled for this conversation.
When a chart materially improves the answer, analyze the data first and then output one or more Apache ECharts option objects inside fenced \`\`\`echarts code blocks.
- The block content must be strict JSON: no JavaScript, functions, comments, trailing commas, Markdown, or HTML.
- Output the ECharts option object directly, not wrapped in another property.
- Always include a non-empty series array and a concise title.text.
- Choose any appropriate ECharts chart type. Supported 2D types include line, bar, pie, scatter, effectScatter, radar, heatmap, funnel, gauge, treemap, sunburst, sankey, graph, lines, pictorialBar, themeRiver, custom-free candlestick, and boxplot.
- ECharts GL is available. When 3D materially improves the result, you may use bar3D, line3D, scatter3D, surface, map3D, lines3D, graphGL, flowGL, globe, geo3D, or grid3D. Include every required 3D coordinate component and keep the configuration strict JSON.
- Prefer 2D charts for simple comparisons. Use 3D only when the extra spatial dimension communicates real information or the user explicitly requests it.
- Use clear Chinese labels when the conversation is Chinese. Include tooltip and legend when helpful.
- Do not hard-code global color palettes or series itemStyle/lineStyle colors unless color carries essential data semantics. The user can select an official ECharts theme in the chart card.
- Prefer accurate, readable charts over decorative complexity. Aggregate excessive categories or data points before charting.
- Never invent missing data. Briefly state important conclusions outside the chart block.
The application renders these JSON blocks as interactive charts directly in the chat.`,
  version: "1.0.0",
};

const MERMAID_DIAGRAM_SKILL: BuiltinToolDefinition = {
  accent: "blue",
  category: "creation",
  description: "把结构、关系和过程转换为可缩放的 Mermaid 图表。",
  features: ["流程图与时序图", "状态图、ER 图与甘特图", "SVG/PNG 导出"],
  functions: [],
  id: "mermaid-diagram",
  kind: "skill",
  name: "Mermaid 流程图",
  shortName: "Mermaid",
  status: "available",
  systemPrompt: `Mermaid diagram skill is enabled for this conversation.
When a diagram materially improves the answer, output valid Mermaid syntax inside a fenced \`\`\`mermaid code block.
- Use flowcharts for processes and relationships, sequence diagrams for interactions, state diagrams for lifecycles, ER diagrams for data models, and Gantt charts for schedules.
- Keep labels concise and use Chinese labels when the conversation is Chinese.
- Do not include HTML, click directives, initialization directives, external links, icons, images, or scripts.
- Prefer one focused diagram over a dense decorative diagram. Split a large diagram when necessary.
- Briefly explain important conclusions outside the code block.
The application renders Mermaid blocks as interactive diagram artifacts.`,
  version: "1.0.0",
};

const MARKMAP_MINDMAP_SKILL: BuiltinToolDefinition = {
  accent: "emerald",
  category: "creation",
  description: "把主题、知识点和方案层级转换为可交互的 Markmap 脑图。",
  features: ["Markdown 层级生成", "缩放与节点折叠", "SVG/PNG 导出"],
  functions: [],
  id: "markmap-mindmap",
  kind: "skill",
  name: "Markmap 脑图",
  shortName: "Markmap",
  status: "available",
  systemPrompt: `Markmap mind map skill is enabled for this conversation.
When a mind map materially improves the answer, output its Markdown outline inside a fenced \`\`\`markmap code block.
- Start with exactly one level-1 heading as the central topic.
- Use nested headings and bullet lists to express hierarchy, normally no more than 5 levels deep.
- Keep every node concise and use Chinese labels when the conversation is Chinese.
- Do not include raw HTML, images, scripts, iframes, or embedded external content.
- Briefly explain important conclusions outside the code block.
The application renders Markmap blocks as interactive mind-map artifacts.`,
  version: "1.0.0",
};

const CALCULATOR_TOOL: BuiltinToolDefinition = {
  accent: "amber",
  category: "utilities",
  description: "执行可靠的数学表达式计算、数字统计和常用单位换算。",
  features: ["数学表达式", "统计摘要", "长度、质量、时间、温度换算"],
  functions: [
    {
      description:
        "Safely calculate a mathematical expression. Supports +, -, *, /, %, ^, parentheses, pi, e, and common functions such as sqrt, abs, min, max, pow, sin, cos, tan, log and ln.",
      name: "calculate_expression",
      parameters: {
        additionalProperties: false,
        properties: {
          expression: {
            description: "The expression to calculate.",
            maxLength: 500,
            type: "string",
          },
          precision: {
            description: "Decimal places in the result, from 0 to 12. Defaults to 10.",
            maximum: 12,
            minimum: 0,
            type: "integer",
          },
        },
        required: ["expression"],
        type: "object",
      },
    },
    {
      description: "Calculate count, sum, mean, median, minimum and maximum for numeric data.",
      name: "summarize_numbers",
      parameters: {
        additionalProperties: false,
        properties: {
          numbers: {
            description: "Numbers to summarize.",
            items: { type: "number" },
            maxItems: 1000,
            type: "array",
          },
          precision: { maximum: 12, minimum: 0, type: "integer" },
        },
        required: ["numbers"],
        type: "object",
      },
    },
    {
      description:
        "Convert a value between compatible units. Supported units: mm, cm, m, km, in, ft, yd, mi, mg, g, kg, oz, lb, ms, s, min, h, day, C, F and K.",
      name: "convert_units",
      parameters: {
        additionalProperties: false,
        properties: {
          from: { description: "Source unit symbol.", maxLength: 10, type: "string" },
          precision: { maximum: 12, minimum: 0, type: "integer" },
          to: { description: "Target unit symbol.", maxLength: 10, type: "string" },
          value: { description: "Value to convert.", type: "number" },
        },
        required: ["value", "from", "to"],
        type: "object",
      },
    },
  ],
  id: "calculator",
  kind: "tool",
  name: "轻量计算器",
  shortName: "计算器",
  status: "available",
  version: "1.0.0",
};

export const BUILTIN_TOOLS = [
  WORD_TOOL,
  EXCEL_TOOL,
  DATA_VISUALIZATION_SKILL,
  MERMAID_DIAGRAM_SKILL,
  MARKMAP_MINDMAP_SKILL,
  CALCULATOR_TOOL,
] as const;

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
