"use client";

import Image from "next/image";
import { Monitor, Moon, Smartphone, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { MessageItem } from "@/components/chat/MessageItem";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { GeneratedFileState, Message, MessageSegment } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import { ChartGenerationTest, type GeneratedTestChart } from "./ChartGenerationTest";

import { WebResearchTest, type WebTestResult } from "./WebResearchTest";
import { webResearchMessage } from "./web-research-fixture";

type Scenario = "done" | "running" | "error";
type PreviewView = "calls" | "visuals" | "web";

const visualizationMessage: Message = {
  id: "mock-visualization-results",
  role: "model",
  model: "MarkAI",
  content: [
    "下面是资料整理进度与知识库结构。数据均为界面演示用的固定示例。",
    "",
    "向量排版示例：(a⃗ × b⃗)·c⃗ = [a⃗, b⃗, c⃗]。",
    "",
    "```echarts",
    JSON.stringify({
      title: { text: "资料整理进度", show: false },
      color: ["#7c9ac5"],
      tooltip: { trigger: "axis" },
      grid: { top: 24, right: 16, bottom: 28, left: 40, containLabel: true },
      xAxis: {
        type: "category",
        data: ["五月", "六月", "七月", "八月", "九月"],
        axisTick: { show: false },
        axisLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "篇",
        splitLine: { lineStyle: { type: "dashed", opacity: 0.3 } },
      },
      series: [{ type: "bar", barMaxWidth: 36, data: [18, 26, 33, 47, 62] }],
    }),
    "```",
    "",
    "下面是底部图例与月份标签的排版示例，缩窄窗口可查看图例翻页效果。",
    "",
    "```echarts",
    JSON.stringify({
      title: { text: "月度销售额、去年同期与利润组合图", left: "center" },
      tooltip: { trigger: "axis" },
      legend: { bottom: 0 },
      grid: { top: 76, right: 48, bottom: 20, left: 48 },
      xAxis: { type: "category", data: Array.from({ length: 12 }, (_, i) => `${i + 1}月`) },
      yAxis: [
        { type: "value", name: "销售额（万元）" },
        { type: "value", name: "利润（万元）" },
      ],
      series: [
        {
          name: "销售额（万元）",
          type: "bar",
          data: [130, 98, 158, 143, 170, 190, 176, 163, 200, 218, 270, 248],
        },
        {
          name: "去年同期销售额（万元）",
          type: "bar",
          data: [115, 88, 137, 130, 150, 167, 159, 146, 174, 188, 230, 212],
        },
        {
          name: "利润（万元）",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          data: [26, 19, 33, 30, 36, 42, 39, 34, 46, 51, 66, 59],
        },
      ],
    }),
    "```",
    "",
    "知识库可以按以下结构组织，每个节点都可以展开、收起。",
    "",
    "```markmap",
    "# 团队知识库",
    "## 项目资料",
    "### 需求与方案",
    "### 实施记录",
    "## 团队经验",
    "### 常见问题",
    "### 操作指南",
    "## 维护流程",
    "### 内容归档",
    "### 定期更新",
    "```",
  ].join("\n"),
};

const parseScenario = (value?: string): Scenario =>
  value === "running" || value === "error" ? value : "done";

const wordStep = (
  toolName: string,
  label: string,
  current: number,
  phase: NonNullable<GeneratedFileState["progress"]>["phase"],
): MessageSegment => ({
  type: "generated-file",
  generatedFile: {
    callId: `mock-${toolName}-${current}`,
    toolId: "word-document",
    toolName,
    status: "done",
    progress: { current, total: 3, phase, label },
  },
});

function createPreviewMessage(scenario: Scenario): Message {
  return {
    id: `mock-tool-calls-${scenario}`,
    role: "model",
    model: "MarkAI",
    content: "已完成资料整理，并检查了文档结构。",
    segments: [
      { type: "content", content: "我会先检索并核对资料，再分章节整理文档。" },
      {
        type: "tool",
        webSearch: {
          tool: "web_search",
          status: "done",
          query: "团队知识库建设 资料归档与检索",
          costTime: 860,
          results: [
            {
              title: "团队知识库实践指南（模拟来源）",
              url: "https://example.com/knowledge-base",
              content: "统一命名、明确维护责任，并定期更新内容。此条来源仅用于界面预览。",
              favicon: "/images/markai.svg",
            },
          ],
        },
      },
      {
        type: "tool",
        webSearch: {
          tool: "read_webpage",
          status: scenario === "error" ? "error" : "done",
          query: "https://example.com/knowledge-base",
          url: "https://example.com/knowledge-base",
          title: "团队知识库实践指南（模拟来源）",
          description: "资料的分类、命名与维护流程。",
          content: "建立统一的资料入口，按项目分类归档，定期检查过期内容。",
          error: scenario === "error" ? "网页读取超时，请稍后重试或更换来源。" : undefined,
          costTime: 420,
          results: [],
        },
      },
      {
        type: "generated-file",
        generatedFile: {
          callId: "mock-calculator",
          toolId: "calculator",
          toolName: "calculate_expression",
          status: "done",
        },
      },
      wordStep("word_document_begin", "已规划文档结构", 0, "plan"),
      wordStep("word_document_append", "已完成第 1 章 · 项目背景", 1, "write"),
      wordStep("word_document_append", "已完成第 2 章 · 资料整理", 2, "write"),
      wordStep("word_document_append", "已完成第 3 章 · 实施建议", 3, "write"),
      wordStep("word_document_inspect", "已检查文档结构与格式", 3, "inspect"),
      {
        type: "generated-file",
        generatedFile: {
          callId: "mock-finalize",
          toolId: "word-document",
          toolName: "word_document_finalize",
          status: scenario,
          error: scenario === "error" ? "文档打包失败，请保留现有内容后重试。" : undefined,
          progress: {
            current: 3,
            total: 3,
            phase: "finalize",
            label: "已完成文档整理",
            detail: "3 个章节已构建完成",
          },
        },
      },
      ...(scenario === "done"
        ? [
            {
              type: "content" as const,
              content: "资料已整理完毕。文档包含项目背景、资料整理和实施建议三个章节。",
            },
          ]
        : []),
    ],
  };
}

// These actions are hidden by MessageItem's readOnly mode. No model/store mutations are used.
const readOnlyActions = {
  cancelEditingMessage: () => {},
  continueMessage: async () => {},
  copyMessage: () => {},
  deleteMessage: () => {},
  enableMultiSelect: () => {},
  getMessageModel: () => undefined,
  menuUnavailable: () => {},
  regenerateMessage: async () => {},
  saveEditingMessage: () => {},
  selectMessageVariant: async () => {},
  setEditingContent: () => {},
  setOpenMenuMessageId: () => {},
  startEditingMessage: () => {},
  toggleCollapseMessage: () => {},
  toggleSelectedMessage: () => {},
  translateMessage: async () => {},
};

export function ToolCallsPreview({
  embedded,
  initialScenario,
  initialTheme,
  initialView,
}: {
  embedded: boolean;
  initialScenario?: string;
  initialTheme?: string;
  initialView?: string;
}) {
  const { setTheme } = useTheme();
  const [scenario, setScenario] = useState<Scenario>(parseScenario(initialScenario));
  const [mobile, setMobile] = useState(false);
  const [view, setView] = useState<PreviewView>(
    initialView === "web" ? "web" : initialView === "calls" ? "calls" : "visuals",
  );
  const [generatedChart, setGeneratedChart] = useState<GeneratedTestChart | null>(null);
  const [generatedWeb, setGeneratedWeb] = useState<WebTestResult | null>(null);
  const [webTestOpen, setWebTestOpen] = useState(false);
  const [modelTestOpen, setModelTestOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState(initialTheme === "dark" ? "dark" : "light");

  useEffect(() => {
    useUIStore.getState().setAppReady(true);
  }, []);

  useEffect(() => {
    setTheme(previewTheme);
  }, [previewTheme, setTheme]);

  const mobileFrameRef = useRef<HTMLIFrameElement>(null);
  const syncMobileChart = () => {
    mobileFrameRef.current?.contentWindow?.postMessage(
      { type: "markai:chart-preview", chart: generatedChart, web: generatedWeb },
      window.location.origin,
    );
  };
  useEffect(() => {
    if (!embedded) {
      mobileFrameRef.current?.contentWindow?.postMessage(
        { type: "markai:chart-preview", chart: generatedChart, web: generatedWeb },
        window.location.origin,
      );
      return;
    }
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        event.data?.type !== "markai:chart-preview"
      )
        return;
      const chart = event.data.chart;
      if (
        chart === null ||
        (typeof chart?.message?.content === "string" &&
          typeof chart?.prompt === "string" &&
          typeof chart?.model === "string")
      )
        setGeneratedChart(chart);
      if (event.data.web === null || typeof event.data.web?.message?.content === "string")
        setGeneratedWeb(event.data.web);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [embedded, generatedChart, generatedWeb]);

  const dark = previewTheme === "dark";
  return (
    <main className={cn("h-dvh bg-[var(--chat-app-bg)]", !embedded && "p-2")}>
      <section
        className={cn(
          "flex h-full min-w-0 flex-col overflow-hidden bg-[var(--chat-panel-bg)]",
          !embedded && "rounded-xl border border-gray-200 dark:border-white/10",
        )}
      >
        {!embedded && (
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <Image alt="MarkAI" height={24} src="/images/markai.svg" width={24} />
              <div>
                <h1 className="text-sm font-medium">工具、图表与联网预览</h1>
                <p className="mt-0.5 text-xs text-gray-400">
                  {view === "web"
                    ? "默认展示真实网页回放 · 展开测试可调用所选模型"
                    : "默认展示模拟消息 · 点击测试按钮可调用所选模型"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                className="[&_button]:min-h-10 md:[&_button]:min-h-7"
                onChange={setView}
                options={[
                  { label: "工具调用", value: "calls" },
                  { label: "图表与脑图", value: "visuals" },
                  { label: "网页与图片", value: "web" },
                ]}
                value={view}
              />
              {view === "calls" && (
                <SegmentedControl
                  className="[&_button]:min-h-10 md:[&_button]:min-h-7"
                  onChange={setScenario}
                  options={[
                    { label: "已完成", value: "done" },
                    { label: "执行中", value: "running" },
                    { label: "调用失败", value: "error" },
                  ]}
                  value={scenario}
                />
              )}
              <IconButton
                aria-label={mobile ? "切换桌面预览" : "切换 390px 移动预览"}
                data-markai-tooltip={mobile ? "切换桌面预览" : "切换 390px 移动预览"}
                onClick={() => setMobile(!mobile)}
                shape="rounded"
                size="sm"
              >
                {mobile ? <Monitor size={16} /> : <Smartphone size={16} />}
              </IconButton>
              <IconButton
                aria-label={dark ? "切换浅色预览" : "切换深色预览"}
                data-markai-tooltip={dark ? "切换浅色预览" : "切换深色预览"}
                onClick={() => setPreviewTheme(dark ? "light" : "dark")}
                shape="rounded"
                size="sm"
              >
                {dark ? <Sun size={16} /> : <Moon size={16} />}
              </IconButton>
            </div>
          </header>
        )}
        {mobile ? (
          <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-[var(--chat-app-bg)] p-3">
            <iframe
              ref={mobileFrameRef}
              onLoad={syncMobileChart}
              className="h-full min-h-[480px] w-[390px] max-w-full shrink-0 rounded-xl border border-gray-200 bg-[var(--chat-panel-bg)] dark:border-white/10"
              src={`/dev/tool-calls?embedded=1&scenario=${scenario}&view=${view}&theme=${dark ? "dark" : "light"}`}
              title="390px 工具与图表移动预览"
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
            <div className="mx-auto w-full max-w-[840px] space-y-7">
              {view === "visuals" && !embedded && (
                <details
                  className="text-sm text-gray-500 dark:text-gray-400"
                  onToggle={(event) => setModelTestOpen(event.currentTarget.open)}
                >
                  <summary className="cursor-pointer py-2">真实模型测试（需要登录）</summary>
                  {modelTestOpen && <ChartGenerationTest onChart={setGeneratedChart} />}
                </details>
              )}
              {view === "web" && !embedded && (
                <details
                  className="text-sm text-gray-500 dark:text-gray-400"
                  onToggle={(event) => setWebTestOpen(event.currentTarget.open)}
                >
                  <summary className="cursor-pointer py-2">真实联网测试（需要登录）</summary>
                  {webTestOpen && <WebResearchTest onResult={setGeneratedWeb} />}
                </details>
              )}
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[var(--chat-user-bubble-bg)] px-4 py-3 text-sm">
                  {view === "web"
                    ? generatedWeb?.prompt || "阅读故宫博物院太和殿页面，核对正文，并展示页面配图。"
                    : view === "visuals"
                      ? generatedChart?.prompt ||
                        "用图表展示资料整理进度，再画一张团队知识库的脑图。"
                      : "请检索团队知识库的建设方法，再整理成三章的文档。"}
                </p>
              </div>
              <MessageItem
                {...readOnlyActions}
                collapsed={false}
                editingContent=""
                editingMessageId={null}
                isConversationTail
                isSelected={false}
                loadingText="正在等待模型响应…"
                message={
                  view === "web"
                    ? generatedWeb?.message || webResearchMessage
                    : view === "visuals"
                      ? generatedChart?.message || visualizationMessage
                      : createPreviewMessage(scenario)
                }
                multiSelectMode={false}
                openMenuMessageId={null}
                readOnly
                selectionLayoutMode={false}
              />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
