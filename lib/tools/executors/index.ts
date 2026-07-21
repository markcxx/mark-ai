import {
  executeCalculateExpression,
  executeConvertUnits,
  executeSummarizeNumbers,
} from "./calculator";
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
    case "calculate_expression":
      return executeCalculateExpression(args);
    case "summarize_numbers":
      return executeSummarizeNumbers(args);
    case "convert_units":
      return executeConvertUnits(args);
    default:
      throw new Error(`不支持的内置工具：${name}`);
  }
};
