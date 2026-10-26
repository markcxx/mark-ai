import type { GeneratedFileState, WebSearchState } from "./types";

export type ToolSummary = { label: string; detail?: string };

const clean = (value?: string) => value?.replace(/\s+/g, " ").trim() || "";
const withDetail = (label: string, detail?: string): ToolSummary => {
  const value = clean(detail);
  return { label, detail: value && !label.includes(value) ? value : undefined };
};

function pageTarget(state: WebSearchState) {
  const result = state.results?.[0];
  const title = clean(state.title || result?.title);
  const url = state.url || result?.url || (state.tool === "read_webpage" ? state.query : "");
  if (title && !/^https?:\/\//i.test(title)) return title;
  try {
    const parsed = new URL(url || title);
    let path = parsed.pathname === "/" ? "" : parsed.pathname;
    try {
      path = decodeURI(path);
    } catch {
      /* Keep malformed percent encoding literal. */
    }
    // A compact address distinguishes pages without displaying credentials or tracking parameters.
    return `${parsed.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return title || clean(url);
  }
}

export function webToolSummary(state: WebSearchState): ToolSummary {
  const running = state.status === "searching";
  const failed = state.status === "error";
  switch (state.tool) {
    case "read_webpage":
      return withDetail(running ? "正在读取" : failed ? "读取失败" : "已读取", pageTarget(state));
    case "find_in_page": {
      const label = running ? "正在查找" : failed ? "查找失败" : "已查找";
      const target = pageTarget(state);
      const matches =
        !running && !failed && state.page?.matches ? ` · ${state.page.matches.length} 处匹配` : "";
      return withDetail(label, `${clean(state.query)}${target ? ` · ${target}` : ""}${matches}`);
    }
    case "show_images":
      return {
        label: running
          ? "正在整理图片"
          : failed
            ? "图片展示失败"
            : `已展示 ${state.images?.length || 0} 张图片`,
      };
    default:
      return withDetail(running ? "正在搜索" : failed ? "搜索失败" : "已搜索", state.query);
  }
}

// Each action has its own state wording, including tools sharing one plugin.
const ACTIONS: Record<string, readonly [string, string, string]> = {
  calculate_expression: ["正在计算表达式", "已完成表达式计算", "表达式计算失败"],
  summarize_numbers: ["正在统计数值", "已完成数值统计", "数值统计失败"],
  convert_units: ["正在换算单位", "已完成单位换算", "单位换算失败"],
  create_excel_workbook: ["正在生成表格", "已生成表格", "表格生成失败"],
  render_echarts_chart: ["正在校验图表", "已生成图表", "图表校验失败"],
  word_document_begin: ["正在规划文档结构", "已规划文档结构", "文档规划失败"],
  word_document_open: ["正在打开可编辑文档", "已打开可编辑文档", "打开文档失败"],
  word_document_append: ["正在构建文档章节", "已构建文档章节", "章节构建失败"],
  word_document_revise: ["正在修改文档内容", "已修改文档内容", "文档修改失败"],
  word_document_restyle: ["正在修改文档样式", "已修改文档样式", "样式修改失败"],
  word_document_inspect: ["正在检查文档结构与格式", "已检查文档结构与格式", "文档检查失败"],
  word_document_finalize: ["正在打包 Word 文档", "已生成 Word 文档", "文档打包失败"],
};

export function generatedToolSummary(state: GeneratedFileState, toolLabel?: string): ToolSummary {
  const action = ACTIONS[state.toolName];
  const name = clean(toolLabel) || clean(state.toolName) || "工具";
  const base =
    state.status === "running"
      ? action?.[0] || `正在执行${name}`
      : state.status === "error"
        ? action?.[2] || `${name}执行失败`
        : clean(state.progress?.label) || action?.[1] || `已执行${name}`;
  return withDetail(base, state.file?.name || state.progress?.detail || state.preview?.title);
}
