import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  executeAppendWordDocument,
  executeBeginWordDocument,
  executeFinalizeWordDocument,
  executeInspectWordDocument,
  executeOpenWordDocument,
  executeRestyleWordDocument,
} from "../executors/word";
import {
  appendWordDocumentBlocks,
  createWordDocumentJob,
  getWordDocumentJob,
  inspectWordDocumentJob,
  reviseWordDocumentBlock,
  reviseWordDocumentBlocks,
} from "./job-store";
import * as wordPersistence from "./persistence";
import { getWordDocumentPreset } from "./presets";
import { calculateTableColumnWidths, renderWordDocument } from "./renderer";
import { WORD_DOCUMENT_TYPES } from "./types";
import {
  parseWordBlock,
  parseWordBlocks,
  parseWordDocumentType,
  parseWordFeatures,
  parseWordMetadata,
  parseWordOutline,
} from "./validation";

const createJob = () =>
  createWordDocumentJob(new Map<string, unknown>(), {
    features: ["header", "page-number", "table-of-contents"],
    outline: [
      { id: "s1", level: 1, title: "概述" },
      { id: "s2", level: 1, title: "方案" },
    ],
    preset: "formal-report-cn",
    title: "测试文档",
  });

describe("stepwise Word document jobs", () => {
  it("guides the model through begin, append, and inspect actions", async () => {
    const context = {
      runtimeState: new Map<string, unknown>(),
      sessionId: "session-1",
      userId: "user-1",
    };
    const started = await executeBeginWordDocument(
      {
        documentType: "meeting-minutes",
        metadata: [{ label: "时间", value: "2026 年 7 月 31 日" }],
        outline: [{ id: "s1", level: 1, title: "概述" }],
        subtitle: "产品评审会",
        title: "分步文档",
      },
      context,
    );
    const documentId = String(started.content.documentId);
    expect(started.content.documentType).toBe("meeting-minutes");
    expect(started.content.nextAction).toEqual({ name: "word_document_append", sectionId: "s1" });
    expect(started.preview).toMatchObject({
      blocks: [],
      documentId,
      documentType: "meeting-minutes",
      kind: "word-document",
      revision: 0,
      title: "分步文档",
    });

    const appended = await executeAppendWordDocument(
      {
        blocks: [
          { id: "s1-h1", level: 1, text: "概述", type: "heading" },
          { id: "s1-p1", text: "正文", type: "paragraph" },
        ],
        complete: true,
        documentId,
        sectionId: "s1",
      },
      context,
    );
    expect(appended.content.nextAction).toEqual({ name: "word_document_inspect" });
    expect(appended.progress).toMatchObject({ current: 1, phase: "write", total: 1 });
    expect(appended.preview).toMatchObject({
      completedSectionIds: ["s1"],
      documentId,
      revision: 1,
    });
    expect(appended.preview?.blocks).toHaveLength(2);

    const inspected = await executeInspectWordDocument({ documentId }, context);
    expect(inspected.content).toMatchObject({
      canFinalize: true,
      nextAction: { name: "word_document_finalize" },
    });
  });

  it("tracks completed sections and requires all sections before finalization", () => {
    const job = createJob();
    appendWordDocumentBlocks(
      job,
      "s1",
      [
        { id: "s1-h1", level: 1, text: "概述", type: "heading" },
        { id: "s1-p1", text: "第一章正文。", type: "paragraph" },
      ],
      true,
    );

    const firstInspection = inspectWordDocumentJob(job);
    expect(firstInspection.canFinalize).toBe(false);
    expect(firstInspection.missingSections).toEqual([{ id: "s2", title: "方案" }]);

    appendWordDocumentBlocks(
      job,
      "s2",
      [{ id: "s2-h1", level: 1, text: "方案", type: "heading" }],
      true,
    );
    const finalInspection = inspectWordDocumentJob(job);
    expect(finalInspection.canFinalize).toBe(true);
    expect(finalInspection.blockCount).toBe(3);
    expect(job.inspectedRevision).toBe(job.revision);
  });

  it("replaces a block while keeping section ownership and invalidating inspection", () => {
    const job = createJob();
    appendWordDocumentBlocks(
      job,
      "s1",
      [{ id: "s1-p1", text: "普通正文", type: "paragraph" }],
      true,
    );
    inspectWordDocumentJob(job);

    reviseWordDocumentBlock(job, "s1-p1", "replace", {
      format: { alignment: "center", spacingAfter: 12 },
      id: "s1-p1",
      runs: [{ bold: true, color: "2563EB", text: "修改后的正文" }],
      type: "paragraph",
    });

    expect(job.sectionBlockIds.s1).toEqual(["s1-p1"]);
    expect(job.inspectedRevision).toBeUndefined();
    expect(job.blocks[0]).toMatchObject({ format: { alignment: "center" }, id: "s1-p1" });
  });

  it("can split one inspected block into multiple blocks without losing section ownership", () => {
    const job = createJob();
    appendWordDocumentBlocks(
      job,
      "s1",
      [{ id: "s1-long", text: "很长的正文", type: "paragraph" }],
      true,
    );

    reviseWordDocumentBlocks(job, "s1-long", "replace", [
      { id: "s1-p1", text: "第一段", type: "paragraph" },
      { id: "s1-p2", text: "第二段", type: "paragraph" },
    ]);

    expect(job.blocks.map((block) => block.id)).toEqual(["s1-p1", "s1-p2"]);
    expect(job.sectionBlockIds.s1).toEqual(["s1-p1", "s1-p2"]);
  });

  it("can insert a missing heading into an already completed section", () => {
    const job = createJob();
    appendWordDocumentBlocks(job, "s1", [{ id: "s1-p1", text: "正文", type: "paragraph" }], true);

    reviseWordDocumentBlocks(job, "s1-p1", "insert-before", [
      { id: "s1-h1", level: 1, text: "概述", type: "heading" },
    ]);
    appendWordDocumentBlocks(
      job,
      "s2",
      [{ id: "s2-h1", level: 1, text: "方案", type: "heading" }],
      true,
    );

    expect(job.blocks.map((block) => block.id)).toEqual(["s1-h1", "s1-p1", "s2-h1"]);
    expect(inspectWordDocumentJob(job).canFinalize).toBe(true);
  });

  it("enforces outline order so the model advances one section at a time", () => {
    const job = createJob();
    expect(() =>
      appendWordDocumentBlocks(
        job,
        "s2",
        [{ id: "s2-h1", level: 1, text: "方案", type: "heading" }],
        true,
      ),
    ).toThrow("先完成章节");
  });

  it("renders the accumulated IR as a DOCX zip", async () => {
    const job = createJob();
    appendWordDocumentBlocks(
      job,
      "s1",
      [
        { id: "s1-h1", level: 1, text: "概述", type: "heading" },
        {
          id: "s1-p1",
          runs: [{ text: "普通文字" }, { bold: true, color: "2563EB", text: "重点文字" }],
          type: "paragraph",
        },
        {
          header: true,
          id: "s1-t1",
          rows: [
            ["项目", "结果"],
            ["状态", "完成"],
          ],
          type: "table",
        },
      ],
      true,
    );
    appendWordDocumentBlocks(
      job,
      "s2",
      [{ id: "s2-h1", level: 1, text: "方案", type: "heading" }],
      true,
    );

    const bytes = await renderWordDocument(job);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
  });

  it("opens a finalized document in a new request and restyles it without rebuilding blocks", async () => {
    const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "markai-word-source-"));
    const previousDatabasePath = process.env.MARKAI_SQLITE_PATH;
    process.env.MARKAI_SQLITE_PATH = path.join(temporaryDirectory, "markai.sqlite");
    try {
      const job = createJob();
      appendWordDocumentBlocks(
        job,
        "s1",
        [
          { id: "s1-h1", level: 1, text: "概述", type: "heading" },
          { id: "s1-p1", text: "保持不变的正文", type: "paragraph" },
        ],
        true,
      );
      appendWordDocumentBlocks(
        job,
        "s2",
        [{ id: "s2-h1", level: 1, text: "方案", type: "heading" }],
        true,
      );
      job.generatedFileId = "file-v1";
      await wordPersistence.saveWordDocumentSource(job, {
        generatedFileId: "file-v1",
        sessionId: "session-1",
        userId: "user-1",
      });

      const nextRequestContext = {
        runtimeState: new Map<string, unknown>(),
        sessionId: "session-1",
        userId: "user-1",
      };
      const opened = await executeOpenWordDocument({}, nextRequestContext);
      const documentId = String(opened.content.documentId);
      const originalBlocks = structuredClone(job.blocks);
      expect(opened.content.generatedFileId).toBe("file-v1");

      await executeRestyleWordDocument(
        { color: "#008000", documentId, scope: "all-text" },
        nextRequestContext,
      );
      const edited = getWordDocumentJob(nextRequestContext.runtimeState, documentId);
      expect(edited.blocks).toEqual(originalBlocks);
      expect(edited.styleOverrides).toEqual({ "all-text": { color: "008000" } });
      expect(edited.inspectedRevision).toBeUndefined();

      await executeInspectWordDocument({ documentId }, nextRequestContext);
      const finalized = await executeFinalizeWordDocument({ documentId }, nextRequestContext);
      expect(finalized.file).toMatchObject({
        contentType: expect.stringContaining("wordprocessingml"),
      });

      const laterRequestContext = {
        runtimeState: new Map<string, unknown>(),
        sessionId: "session-1",
        userId: "user-1",
      };
      const reopened = await executeOpenWordDocument({}, laterRequestContext);
      expect(reopened.content.generatedFileId).toBe(finalized.file?.id);
      const persisted = getWordDocumentJob(laterRequestContext.runtimeState, documentId);
      expect(persisted.blocks).toEqual(originalBlocks);
      expect(persisted.styleOverrides).toEqual({ "all-text": { color: "008000" } });

      await executeRestyleWordDocument(
        { color: "#006400", documentId, scope: "all-text" },
        laterRequestContext,
      );
      await executeInspectWordDocument({ documentId }, laterRequestContext);
      const persistenceError = vi
        .spyOn(wordPersistence, "saveWordDocumentSource")
        .mockRejectedValueOnce(new Error("word_document_sources does not exist"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const fallback = await executeFinalizeWordDocument({ documentId }, laterRequestContext);
      expect(fallback.file?.url).toContain("/api/files/");
      expect(fallback.content).toMatchObject({ editableSourceSaved: false, success: true });
      expect(consoleError).toHaveBeenCalledWith(
        "Word editable source persistence failed:",
        expect.any(Error),
      );
      persistenceError.mockRestore();
      consoleError.mockRestore();
    } finally {
      if (previousDatabasePath === undefined) delete process.env.MARKAI_SQLITE_PATH;
      else process.env.MARKAI_SQLITE_PATH = previousDatabasePath;
      rmSync(temporaryDirectory, { force: true, recursive: true });
    }
  });
});

describe("Word document input validation", () => {
  it("accepts sparse local formatting instead of requiring full docx options", () => {
    expect(
      parseWordBlock({
        format: { firstLineIndentChars: 2, lineSpacing: 1.5 },
        id: "s1-p1",
        runs: [{ bold: true, color: "#2563eb", size: 14, text: "重点" }],
        type: "paragraph",
      }),
    ).toMatchObject({
      format: { firstLineIndentChars: 2, lineSpacing: 1.5 },
      runs: [{ bold: true, color: "2563EB", size: 14, text: "重点" }],
    });
  });

  it("rejects duplicate IDs and oversized batches", () => {
    expect(() =>
      parseWordBlocks([
        { id: "same", text: "一", type: "paragraph" },
        { id: "same", text: "二", type: "paragraph" },
      ]),
    ).toThrow("不能重复");
    expect(() =>
      parseWordBlocks(
        Array.from({ length: 41 }, (_, index) => ({
          id: `p${index}`,
          text: "正文",
          type: "paragraph",
        })),
      ),
    ).toThrow("1 到 40");
  });

  it("rejects duplicate outline IDs", () => {
    expect(() =>
      parseWordOutline([
        { id: "s1", level: 1, title: "第一章" },
        { id: "s1", level: 2, title: "重复章节" },
      ]),
    ).toThrow("重复");
  });

  it("keeps model-controlled inline font sizes within the document type scale", () => {
    expect(() =>
      parseWordBlock({
        id: "s1-p1",
        runs: [{ size: 18, text: "过大的正文" }],
        type: "paragraph",
      }),
    ).toThrow("8 到 16");
  });

  it("enables polished page furniture by default", () => {
    expect(parseWordFeatures(undefined)).toEqual(["header", "page-number"]);
  });

  it("validates document families and compact opening metadata", () => {
    expect(parseWordDocumentType("contract")).toBe("contract");
    expect(() => parseWordDocumentType("one-template")).toThrow("文档类型无效");
    expect(
      parseWordMetadata([
        { label: "甲方", value: "示例公司" },
        { label: "日期", value: "2026-07-31" },
      ]),
    ).toHaveLength(2);
  });
});

describe("Word design preset regression", () => {
  it("provides ten genuinely distinct document families with exact geometry", () => {
    const presets = WORD_DOCUMENT_TYPES.map(getWordDocumentPreset);
    expect(presets).toHaveLength(10);
    expect(new Set(presets.map((preset) => preset.name)).size).toBe(10);
    expect(new Set(presets.map((preset) => preset.title.size)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(presets.map((preset) => preset.opening.layout)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(presets.map((preset) => preset.table.headerFill)).size).toBeGreaterThanOrEqual(
      8,
    );
    for (const preset of presets) {
      expect(preset.body.size).toBeGreaterThanOrEqual(10);
      expect(preset.body.size).toBeLessThanOrEqual(11);
      expect(preset.table.width).toBe(
        preset.page.width - preset.page.margins.left - preset.page.margins.right,
      );
    }
  });

  it("keeps legacy persisted preset IDs mapped to the new families", () => {
    expect(getWordDocumentPreset("business-clean").documentType).toBe("general-clean");
    expect(getWordDocumentPreset("formal-report-cn").documentType).toBe("formal-report");
    expect(getWordDocumentPreset("academic-cn").documentType).toBe("academic-paper");
  });

  it.each(WORD_DOCUMENT_TYPES)("renders the %s family as a valid DOCX", async (documentType) => {
    const preset = getWordDocumentPreset(documentType);
    const job = createWordDocumentJob(new Map<string, unknown>(), {
      documentType,
      features: preset.defaultFeatures,
      metadata: [
        { label: "负责人", value: "MarkAI 团队" },
        { label: "版本", value: "V1.0" },
      ],
      outline: [{ id: "s1", level: 1, title: "核心内容" }],
      subtitle: "差异化模板渲染验证",
      title: `${preset.name}示例`,
    });
    appendWordDocumentBlocks(
      job,
      "s1",
      [
        { id: "s1-h1", level: 1, text: "核心内容", type: "heading" },
        {
          id: "s1-p1",
          text: "这是一段用于验证字体、间距、编号和页面结构的示例正文。",
          type: "paragraph",
        },
        {
          header: true,
          id: "s1-t1",
          rows: [
            ["项目", "说明", "状态"],
            ["模板", preset.name, "完成"],
          ],
          type: "table",
        },
      ],
      true,
    );
    const bytes = await renderWordDocument(job);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
  });

  it("allocates fixed table geometry according to content length", () => {
    const widths = calculateTableColumnWidths(
      [
        ["状态", "说明"],
        ["完成", "这是一段明显更长、需要获得更多横向空间的说明文字"],
      ],
      9360,
    );
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(9360);
    expect(widths[1]).toBeGreaterThan(widths[0] * 2);
    expect(widths.every((width) => width > 0)).toBe(true);
  });
});
