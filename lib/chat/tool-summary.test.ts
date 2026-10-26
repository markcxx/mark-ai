import { expect, it } from "vitest";
import { generatedToolSummary, webToolSummary } from "./tool-summary";
import type { ToolSummary } from "./tool-summary";
import type { WebSearchState } from "./types";
const text = (summary: ToolSummary) => [summary.label, summary.detail].filter(Boolean).join(" ");
const readableWebSummary = (...args: Parameters<typeof webToolSummary>) =>
  text(webToolSummary(...args));
const readableGeneratedSummary = (...args: Parameters<typeof generatedToolSummary>) =>
  text(generatedToolSummary(...args));
const search: WebSearchState = { status: "done", query: "mac 图片导入相册", results: [] };
it("distinguishes search queries and reflects running/done/error states", () => {
  expect(readableWebSummary(search)).toBe("已搜索 mac 图片导入相册");
  expect(readableWebSummary({ ...search, status: "searching" })).toBe("正在搜索 mac 图片导入相册");
  expect(readableWebSummary({ ...search, status: "error", query: "iCloud 照片同步" })).toBe(
    "搜索失败 iCloud 照片同步",
  );
  expect(readableWebSummary({ ...search, query: "" })).toBe("已搜索");
});
it("uses a page title when available and a specific compact URL before the page is read", () => {
  const state = {
    ...search,
    tool: "read_webpage" as const,
    query: "https://www.example.com/photos/import?tracking=x#top",
  };
  expect(readableWebSummary(state)).toBe("已读取 example.com/photos/import");
  expect(readableWebSummary({ ...state, title: "在 Mac 上导入照片", status: "searching" })).toBe(
    "正在读取 在 Mac 上导入照片",
  );
  expect(
    readableWebSummary({ ...state, results: [{ url: state.query, title: "照片使用手册" }] }),
  ).toBe("已读取 照片使用手册");
  expect(
    readableWebSummary({ ...state, query: "https://user:pass@example.com/%E0%A4?token=secret" }),
  ).not.toMatch(/user|pass|token|secret/);
});
it("identifies the find term, page and match count without claiming success on failure", () => {
  const state = {
    ...search,
    tool: "find_in_page" as const,
    query: "导入",
    url: "https://support.example.com/photos",
    title: "照片指南",
    page: { startLine: 8, endLine: 9, totalLines: 40, matches: [8, 9] },
  };
  expect(readableWebSummary(state)).toBe("已查找 导入 · 照片指南 · 2 处匹配");
  expect(readableWebSummary({ ...state, status: "error" })).toBe("查找失败 导入 · 照片指南");
});
it("shows the concrete function, filename or document step for non-web tools", () => {
  expect(
    readableGeneratedSummary({
      callId: "1",
      status: "done",
      toolId: "excel-workbook",
      toolName: "create_excel_workbook",
      file: {
        id: "f",
        name: "月度统计.xlsx",
        size: 100,
        contentType: "application/xlsx",
        url: "/file",
      },
    }),
  ).toBe("已生成表格 月度统计.xlsx");
  expect(
    readableGeneratedSummary({
      callId: "2",
      status: "running",
      toolId: "word-document",
      toolName: "word_document_append",
      progress: {
        current: 1,
        total: 3,
        phase: "write",
        label: "已完成第一章",
        detail: "第二章 项目方案",
      },
    }),
  ).toBe("正在构建文档章节 第二章 项目方案");
  expect(
    readableGeneratedSummary({
      callId: "3",
      status: "done",
      toolId: "calculator",
      toolName: "convert_units",
    }),
  ).toBe("已完成单位换算");
  expect(
    readableGeneratedSummary({
      callId: "4",
      status: "error",
      toolId: "custom",
      toolName: "custom_action",
    }),
  ).toBe("custom_action执行失败");
});
