import { saveGeneratedFile } from "../generated-file";
import type { ToolExecutionContext, ToolExecutionResult, ToolProgress } from "../types";
import {
  appendWordDocumentBlocks,
  cacheWordDocumentJob,
  createWordDocumentJob,
  getWordDocumentJob,
  getWordDocumentPreview,
  inspectWordDocumentJob,
  restyleWordDocument,
  reviseWordDocumentBlocks,
  type WordDocumentRevisionAction,
} from "../word/job-store";
import { openWordDocumentSource, saveWordDocumentSource } from "../word/persistence";
import { getWordDocumentPreset } from "../word/presets";
import { renderWordDocument } from "../word/renderer";
import {
  parseRequiredString,
  parseWordBlock,
  parseWordBlocks,
  parseWordDocumentPreset,
  parseWordDocumentStyleScope,
  parseWordDocumentTextStyleOverride,
  parseWordDocumentType,
  parseWordFeatures,
  parseWordMetadata,
  parseWordOutline,
} from "../word/validation";

const getDocumentId = (args: Record<string, unknown>) =>
  parseRequiredString(args.documentId, "Word 任务 ID", 80);

const getOptionalId = (value: unknown, label: string) =>
  value === undefined ? undefined : parseRequiredString(value, label, 256);

const getProgress = (
  phase: ToolProgress["phase"],
  label: string,
  current: number,
  total: number,
  detail?: string,
): ToolProgress => ({ current, detail, label, phase, total });

export const executeBeginWordDocument = async (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  const title = parseRequiredString(args.title, "Word 文档标题", 160);
  const filename =
    typeof args.filename === "string" && args.filename.trim()
      ? args.filename.trim().slice(0, 100)
      : undefined;
  const presetDefinition = getWordDocumentPreset(
    args.documentType !== undefined
      ? parseWordDocumentType(args.documentType)
      : parseWordDocumentPreset(args.preset),
  );
  const outline = parseWordOutline(args.outline);
  const features = parseWordFeatures(args.features, presetDefinition.defaultFeatures);
  const metadata = parseWordMetadata(args.metadata);
  const subtitle =
    args.subtitle === undefined
      ? undefined
      : parseRequiredString(args.subtitle, "Word 文档副标题", 300);
  const job = createWordDocumentJob(context.runtimeState, {
    documentType: presetDefinition.documentType,
    features,
    filename,
    metadata,
    outline,
    preset: presetDefinition.documentType,
    subtitle,
    title,
  });

  return {
    content: {
      documentType: job.documentType,
      documentId: job.id,
      message: `已创建 Word 构建任务，使用“${presetDefinition.name}”预设。请从目录的第一个章节开始追加内容，每次只提交一个章节或一小批内容块。`,
      nextAction: {
        name: "word_document_append",
        sectionId: outline[0].id,
      },
      outline,
      revision: job.revision,
    },
    preview: getWordDocumentPreview(job),
    progress: getProgress(
      "plan",
      "文档结构已规划",
      0,
      outline.length,
      `${outline.length} 个章节待生成`,
    ),
  };
};

export const executeOpenWordDocument = async (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  const requestedDocumentId = getOptionalId(args.documentId, "Word 任务 ID");
  const requestedFileId = getOptionalId(args.fileId, "Word 文件 ID");
  const job = await openWordDocumentSource({
    documentId: requestedDocumentId,
    generatedFileId: requestedFileId,
    sessionId: context.sessionId,
    userId: context.userId,
  });
  if (!job) {
    throw new Error(
      requestedDocumentId || requestedFileId
        ? "当前会话中找不到对应的可编辑 Word 文档"
        : "当前会话还没有可编辑的 Word 文档，请先生成一份文档",
    );
  }
  cacheWordDocumentJob(context.runtimeState, job);
  const inspection = inspectWordDocumentJob(job);

  return {
    content: {
      ...inspection,
      generatedFileId: job.generatedFileId,
      message:
        "已打开现有 Word 的可编辑结构。请直接执行局部修订或文档级样式修改，不要重新规划和生成正文。",
      nextActions: ["word_document_restyle", "word_document_revise"],
      styleOverrides: job.styleOverrides || {},
      documentType: job.documentType,
      title: job.title,
    },
    preview: getWordDocumentPreview(job),
    progress: getProgress(
      "revise",
      "已打开现有 Word 文档",
      inspection.blockCount,
      inspection.blockCount,
      `${inspection.blockCount} 个原始内容块保持不变`,
    ),
  };
};

export const executeAppendWordDocument = async (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  const job = getWordDocumentJob(context.runtimeState, getDocumentId(args));
  const sectionId = parseRequiredString(args.sectionId, "章节 ID", 40);
  const blocks = parseWordBlocks(args.blocks);
  const complete = args.complete === true;
  appendWordDocumentBlocks(job, sectionId, blocks, complete);

  const completed = new Set(job.completedSectionIds);
  const nextSection = job.outline.find((section) => !completed.has(section.id));
  const detail = complete
    ? `章节已完成，本步新增 ${blocks.length} 个内容块`
    : `已新增 ${blocks.length} 个内容块，请继续完成当前章节`;

  return {
    content: {
      addedBlockIds: blocks.map((block) => block.id),
      completedSections: job.completedSectionIds.length,
      documentId: job.id,
      message: detail,
      nextAction: nextSection
        ? { name: "word_document_append", sectionId: nextSection.id }
        : { name: "word_document_inspect" },
      outlineSections: job.outline.length,
      revision: job.revision,
    },
    preview: getWordDocumentPreview(job),
    progress: getProgress(
      "write",
      `已构建章节：${job.outline.find((section) => section.id === sectionId)?.title || sectionId}`,
      job.completedSectionIds.length,
      job.outline.length,
      detail,
    ),
  };
};

export const executeReviseWordDocument = async (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  const job = getWordDocumentJob(context.runtimeState, getDocumentId(args));
  const blockId = parseRequiredString(args.blockId, "文档块 ID", 60);
  const action = args.action;
  if (
    action !== "remove" &&
    action !== "replace" &&
    action !== "insert-before" &&
    action !== "insert-after"
  ) {
    throw new Error("修订操作必须是 replace、remove、insert-before 或 insert-after");
  }
  const replacements =
    action === "remove"
      ? []
      : args.blocks !== undefined
        ? parseWordBlocks(args.blocks)
        : action === "replace"
          ? [parseWordBlock(args.replacement)]
          : (() => {
              throw new Error("插入操作必须提供 blocks");
            })();
  reviseWordDocumentBlocks(job, blockId, action as WordDocumentRevisionAction, replacements);

  const actionMessage =
    action === "remove"
      ? `已删除文档块 ${blockId}`
      : action === "replace"
        ? `已将文档块 ${blockId} 替换为 ${replacements.length} 个内容块`
        : `已在文档块 ${blockId}${action === "insert-before" ? "之前" : "之后"}插入 ${replacements.length} 个内容块`;

  return {
    content: {
      addedBlockIds: replacements.map((block) => block.id),
      documentId: job.id,
      message: actionMessage,
      nextAction: { name: "word_document_inspect" },
      revision: job.revision,
    },
    preview: getWordDocumentPreview(job),
    progress: getProgress(
      "revise",
      "已完成局部修订",
      job.completedSectionIds.length,
      job.outline.length,
      actionMessage,
    ),
  };
};

export const executeRestyleWordDocument = async (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  const job = getWordDocumentJob(context.runtimeState, getDocumentId(args));
  const scope = parseWordDocumentStyleScope(args.scope);
  const override = parseWordDocumentTextStyleOverride(args);
  restyleWordDocument(job, scope, override);
  const changed = [
    override.color ? `颜色 #${override.color}` : undefined,
    override.font ? `字体 ${override.font}` : undefined,
    override.size ? `字号 ${override.size}pt` : undefined,
  ].filter(Boolean);

  return {
    content: {
      documentId: job.id,
      message: `已修改${scope}范围的${changed.join("、")}；原始正文和结构未重新生成。`,
      nextAction: { name: "word_document_inspect" },
      revision: job.revision,
      scope,
      styleOverride: override,
    },
    preview: getWordDocumentPreview(job),
    progress: getProgress(
      "revise",
      "已完成文档级样式修改",
      job.blocks.length,
      job.blocks.length,
      changed.join("、"),
    ),
  };
};

export const executeInspectWordDocument = async (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  const job = getWordDocumentJob(context.runtimeState, getDocumentId(args));
  const inspection = inspectWordDocumentJob(job);
  const nextAction = inspection.canFinalize
    ? { name: "word_document_finalize" }
    : inspection.missingSections.length > 0
      ? { name: "word_document_append", sectionId: inspection.missingSections[0].id }
      : { name: "word_document_revise" };

  return {
    content: {
      ...inspection,
      message: inspection.canFinalize
        ? "结构检查已通过。若无需进一步调整，请完成 DOCX 打包。"
        : "检查发现未完成项或警告，请先追加或修订对应内容，再重新检查。",
      nextAction,
    },
    preview: getWordDocumentPreview(job),
    progress: getProgress(
      "inspect",
      inspection.canFinalize ? "文档检查通过" : "文档需要继续完善",
      inspection.completedSections,
      inspection.outlineSections,
      inspection.warnings[0] ||
        (inspection.missingSections.length > 0
          ? `${inspection.missingSections.length} 个章节尚未完成`
          : `${inspection.blockCount} 个内容块`),
    ),
  };
};

export const executeFinalizeWordDocument = async (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  const job = getWordDocumentJob(context.runtimeState, getDocumentId(args));
  if (job.inspectedRevision !== job.revision) {
    throw new Error("文档在最近一次修改后尚未检查，请先调用 word_document_inspect");
  }
  const inspection = inspectWordDocumentJob(job);
  if (!inspection.canFinalize) {
    const missing = inspection.missingSections.map((section) => section.title).join("、");
    throw new Error(
      missing ? `以下章节尚未完成：${missing}` : inspection.warnings[0] || "文档尚未达到可完成状态",
    );
  }

  const bytes = await renderWordDocument(job);
  const file = await saveGeneratedFile({
    bytes,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: ".docx",
    fallbackName: job.title,
    filename: job.filename,
    userId: context.userId,
  });
  job.generatedFileId = file.id;
  let editableSourceSaved = true;
  try {
    await saveWordDocumentSource(job, {
      generatedFileId: file.id,
      sessionId: context.sessionId,
      userId: context.userId,
    });
  } catch (error) {
    editableSourceSaved = false;
    console.error("Word editable source persistence failed:", error);
  }

  return {
    content: {
      blockCount: inspection.blockCount,
      documentId: job.id,
      downloadUrl: file.url,
      editableSourceSaved,
      filename: file.name,
      message: editableSourceSaved
        ? "Word 文档已完成渲染，并保存了可供后续局部修改的编辑结构。"
        : "Word 文档已生成并可下载，但可编辑结构未能持久化；请应用数据库迁移后重新生成一次，以启用后续局部修改。",
      success: true,
    },
    file,
    preview: getWordDocumentPreview(job),
    progress: getProgress(
      "finalize",
      "Word 文档已生成",
      inspection.outlineSections,
      inspection.outlineSections,
      editableSourceSaved
        ? `${inspection.blockCount} 个内容块，可继续编辑`
        : `${inspection.blockCount} 个内容块；DOCX 可下载，编辑结构保存失败`,
    ),
  };
};
