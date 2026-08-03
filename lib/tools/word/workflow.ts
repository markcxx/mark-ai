const WORD_TOOL_PREFIX = "word_document_";

const getActionName = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const name = (value as { name?: unknown }).name;
  return typeof name === "string" && name.startsWith(WORD_TOOL_PREFIX) ? name : undefined;
};

export const getWordContinuationToolNames = (
  toolName: string,
  content: Record<string, unknown>,
) => {
  if (!toolName.startsWith(WORD_TOOL_PREFIX)) return undefined;
  if (toolName === "word_document_finalize") return [];

  const nextAction = getActionName(content.nextAction);
  if (nextAction) return [nextAction];

  if (Array.isArray(content.nextActions)) {
    return [
      ...new Set(
        content.nextActions.filter(
          (name): name is string => typeof name === "string" && name.startsWith(WORD_TOOL_PREFIX),
        ),
      ),
    ];
  }

  return [];
};

export const getWordContinuationPrompt = (toolNames: string[]) =>
  `Word 文档工作流尚未完成。不要回复说明文字；现在必须调用以下工具之一：${toolNames.join(
    "、",
  )}。只有 word_document_finalize 成功后才能结束文档生成。`;
