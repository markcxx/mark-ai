import { executeCreateExcel } from "./excel";
import { executeCreateWord } from "./word";

import type { ToolExecutionContext, ToolExecutionResult } from "../types";

export const executeBuiltinTool = async (
  name: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  switch (name) {
    case "create_word_document":
      return executeCreateWord(args, context);
    case "create_excel_workbook":
      return executeCreateExcel(args, context);
    default:
      throw new Error(`Unsupported built-in tool: ${name}`);
  }
};
