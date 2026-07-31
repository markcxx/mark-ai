import {
  executeCalculateExpression,
  executeConvertUnits,
  executeSummarizeNumbers,
} from "./calculator";
import { executeCreateExcel } from "./excel";
import {
  executeAppendWordDocument,
  executeBeginWordDocument,
  executeFinalizeWordDocument,
  executeInspectWordDocument,
  executeOpenWordDocument,
  executeRestyleWordDocument,
  executeReviseWordDocument,
} from "./word";

import type { ToolExecutionContext, ToolExecutionResult } from "../types";

export const executeBuiltinTool = async (
  name: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  switch (name) {
    case "word_document_begin":
      return executeBeginWordDocument(args, context);
    case "word_document_open":
      return executeOpenWordDocument(args, context);
    case "word_document_append":
      return executeAppendWordDocument(args, context);
    case "word_document_revise":
      return executeReviseWordDocument(args, context);
    case "word_document_restyle":
      return executeRestyleWordDocument(args, context);
    case "word_document_inspect":
      return executeInspectWordDocument(args, context);
    case "word_document_finalize":
      return executeFinalizeWordDocument(args, context);
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
