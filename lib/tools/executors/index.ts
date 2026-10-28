import {
  executeCalculateExpression,
  executeConvertUnits,
  executeSummarizeNumbers,
} from "./calculator";

import type { ToolExecutionContext, ToolExecutionResult } from "../types";
import {
  ChartValidationLimitError,
  chartRepairFeedback,
  validateChartSource,
} from "@/lib/chat/server/chart-validation";

export const executeBuiltinTool = async (
  name: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  switch (name) {
    case "render_echarts_chart": {
      const source = JSON.stringify(args.option ?? null);
      const result = await validateChartSource(source);
      if (!result.ok) {
        const failures = Number(context.runtimeState.get("chart-validation-failures") || 0) + 1;
        context.runtimeState.set("chart-validation-failures", failures);
        if (failures >= 3)
          throw new ChartValidationLimitError(
            `图表连续三次未通过校验，已停止自动修正。最后错误：${result.error}`,
          );
        throw new Error(chartRepairFeedback(result.error));
      }
      context.runtimeState.delete("chart-validation-failures");
      return {
        content: {
          success: true,
          title: result.title,
          validation: result.validation,
          instruction: "图表已由应用展示。继续分析结论，不要再次输出该图表或它的 JSON。",
        },
        output: `\n\n\`\`\`echarts\n${JSON.stringify(result.option)}\n\`\`\`\n\n`,
      };
    }
    case "word_document_begin":
      return (await import("./word")).executeBeginWordDocument(args, context);
    case "word_document_open":
      return (await import("./word")).executeOpenWordDocument(args, context);
    case "word_document_append":
      return (await import("./word")).executeAppendWordDocument(args, context);
    case "word_document_revise":
      return (await import("./word")).executeReviseWordDocument(args, context);
    case "word_document_restyle":
      return (await import("./word")).executeRestyleWordDocument(args, context);
    case "word_document_inspect":
      return (await import("./word")).executeInspectWordDocument(args, context);
    case "word_document_finalize":
      return (await import("./word")).executeFinalizeWordDocument(args, context);
    case "create_excel_workbook":
      return (await import("./excel")).executeCreateExcel(args, context);
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
