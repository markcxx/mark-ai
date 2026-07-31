import { randomUUID } from "node:crypto";

import { resolveWordDocumentType } from "./types";
import type {
  WordDocumentBlock,
  WordDocumentFeature,
  WordDocumentInspection,
  WordDocumentJob,
  WordDocumentMetadataItem,
  WordDocumentPresetId,
  WordDocumentPreviewState,
  WordDocumentStyleScope,
  WordDocumentTextStyleOverride,
  WordDocumentType,
  WordOutlineItem,
} from "./types";

const STATE_KEY = "markai:word-document-jobs";

const getJobs = (runtimeState: Map<string, unknown>) => {
  const existing = runtimeState.get(STATE_KEY);
  if (existing instanceof Map) return existing as Map<string, WordDocumentJob>;
  const jobs = new Map<string, WordDocumentJob>();
  runtimeState.set(STATE_KEY, jobs);
  return jobs;
};

export const createWordDocumentJob = (
  runtimeState: Map<string, unknown>,
  input: {
    documentType?: WordDocumentType;
    features: WordDocumentFeature[];
    filename?: string;
    metadata?: WordDocumentMetadataItem[];
    outline: WordOutlineItem[];
    preset?: WordDocumentPresetId;
    subtitle?: string;
    title: string;
  },
) => {
  const documentType =
    input.documentType || resolveWordDocumentType(input.preset || "general-clean");
  const job: WordDocumentJob = {
    ...input,
    blocks: [],
    completedSectionIds: [],
    createdAt: Date.now(),
    documentType,
    id: randomUUID(),
    preset: input.preset || documentType,
    revision: 0,
    sectionBlockIds: {},
  };
  getJobs(runtimeState).set(job.id, job);
  return job;
};

export const getWordDocumentJob = (runtimeState: Map<string, unknown>, documentId: string) => {
  const job = getJobs(runtimeState).get(documentId);
  if (!job) throw new Error("Word 构建任务不存在或已过期，请从规划步骤重新开始");
  job.documentType ||= resolveWordDocumentType(job.preset);
  return job;
};

export const cacheWordDocumentJob = (runtimeState: Map<string, unknown>, job: WordDocumentJob) => {
  job.documentType ||= resolveWordDocumentType(job.preset);
  getJobs(runtimeState).set(job.id, job);
  return job;
};

export const getWordDocumentPreview = (job: WordDocumentJob): WordDocumentPreviewState => ({
  blocks: job.blocks,
  completedSectionIds: job.completedSectionIds,
  documentId: job.id,
  documentType: job.documentType,
  features: job.features,
  kind: "word-document",
  metadata: job.metadata,
  outline: job.outline,
  revision: job.revision,
  styleOverrides: job.styleOverrides,
  subtitle: job.subtitle,
  title: job.title,
});

export const restyleWordDocument = (
  job: WordDocumentJob,
  scope: WordDocumentStyleScope,
  override: WordDocumentTextStyleOverride,
) => {
  job.styleOverrides = {
    ...job.styleOverrides,
    [scope]: {
      ...job.styleOverrides?.[scope],
      ...override,
    },
  };
  job.revision += 1;
  job.inspectedRevision = undefined;
  return job;
};

export const appendWordDocumentBlocks = (
  job: WordDocumentJob,
  sectionId: string,
  blocks: WordDocumentBlock[],
  complete: boolean,
) => {
  const section = job.outline.find((item) => item.id === sectionId);
  if (!section) throw new Error(`目录中不存在章节 ${sectionId}`);
  if (job.completedSectionIds.includes(sectionId)) {
    throw new Error(`章节“${section.title}”已经完成；如需调整，请使用修订步骤`);
  }
  const expectedSection = job.outline.find((item) => !job.completedSectionIds.includes(item.id));
  if (expectedSection && expectedSection.id !== sectionId) {
    throw new Error(`请按目录顺序先完成章节“${expectedSection.title}”（${expectedSection.id}）`);
  }
  const existingIds = new Set(job.blocks.map((block) => block.id));
  const duplicate = blocks.find((block) => existingIds.has(block.id));
  if (duplicate) throw new Error(`块 ID ${duplicate.id} 已存在，请为新块使用唯一 ID`);

  job.blocks.push(...blocks);
  job.sectionBlockIds[sectionId] = [
    ...(job.sectionBlockIds[sectionId] || []),
    ...blocks.map((block) => block.id),
  ];
  if (complete) job.completedSectionIds.push(sectionId);
  job.revision += 1;
  job.inspectedRevision = undefined;
  return job;
};

export const reviseWordDocumentBlock = (
  job: WordDocumentJob,
  blockId: string,
  action: "remove" | "replace",
  replacement?: WordDocumentBlock,
) => {
  const index = job.blocks.findIndex((block) => block.id === blockId);
  if (index < 0) throw new Error(`找不到文档块 ${blockId}`);

  if (action === "remove") {
    job.blocks.splice(index, 1);
    for (const [sectionId, blockIds] of Object.entries(job.sectionBlockIds)) {
      job.sectionBlockIds[sectionId] = blockIds.filter((id) => id !== blockId);
    }
  } else {
    if (!replacement) throw new Error("替换操作必须提供 replacement");
    const conflicting = job.blocks.some(
      (block, blockIndex) => blockIndex !== index && block.id === replacement.id,
    );
    if (conflicting) throw new Error(`块 ID ${replacement.id} 已存在`);
    job.blocks[index] = replacement;
    for (const [sectionId, blockIds] of Object.entries(job.sectionBlockIds)) {
      job.sectionBlockIds[sectionId] = blockIds.map((id) => (id === blockId ? replacement.id : id));
    }
  }

  job.revision += 1;
  job.inspectedRevision = undefined;
  return job;
};

const getBlockPreview = (block: WordDocumentBlock) => {
  if (block.type === "page-break") return "分页";
  if (block.type === "list") return block.items.slice(0, 2).join("；").slice(0, 80);
  if (block.type === "table") return block.rows[0]?.join(" | ").slice(0, 80) || "空表格";
  if (block.type === "heading") return block.text.slice(0, 80);
  const value = block.text || block.runs?.map((run) => run.text).join("") || "";
  return value.slice(0, 80);
};

export const inspectWordDocumentJob = (job: WordDocumentJob): WordDocumentInspection => {
  const completed = new Set(job.completedSectionIds);
  const missingSections = job.outline
    .filter((section) => !completed.has(section.id))
    .map(({ id, title }) => ({ id, title }));
  const warnings: string[] = [];

  for (const section of job.outline) {
    if (completed.has(section.id)) {
      const sectionBlocks = new Set(job.sectionBlockIds[section.id] || []);
      if (sectionBlocks.size === 0) {
        warnings.push(`章节“${section.title}”已标记完成，但没有内容块`);
      } else if (
        !job.blocks.some(
          (block) =>
            sectionBlocks.has(block.id) &&
            block.type === "heading" &&
            block.level === section.level,
        )
      ) {
        warnings.push(`章节“${section.title}”缺少 ${section.level} 级标题块`);
      }
    }
  }
  for (const block of job.blocks) {
    if (
      (block.type === "paragraph" || block.type === "quote") &&
      getBlockPreview(block).length >= 80
    ) {
      const fullText = block.text || block.runs?.map((run) => run.text).join("") || "";
      if (fullText.length > 900) warnings.push(`块 ${block.id} 超过 900 字，建议拆分以改善可读性`);
    }
    if (block.type === "table" && new Set(block.rows.map((row) => row.length)).size > 1) {
      warnings.push(`表格 ${block.id} 的各行列数不一致`);
    }
  }

  const inspection: WordDocumentInspection = {
    blockCount: job.blocks.length,
    canFinalize: missingSections.length === 0 && warnings.length === 0 && job.blocks.length > 0,
    completedSections: job.completedSectionIds.length,
    documentId: job.id,
    missingSections,
    outlineSections: job.outline.length,
    revision: job.revision,
    summary: job.blocks.map((block) => ({
      id: block.id,
      preview: getBlockPreview(block),
      type: block.type,
    })),
    warnings,
  };
  job.inspectedRevision = job.revision;
  return inspection;
};
