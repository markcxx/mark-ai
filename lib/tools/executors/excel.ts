import * as XLSX from "xlsx";

import { saveGeneratedFile } from "../generated-file";
import type { ToolExecutionContext, ToolExecutionResult } from "../types";

const MAX_SHEETS = 10;
const MAX_ROWS = 1000;
const MAX_COLUMNS = 50;
const MAX_CELL_CHARS = 5000;

const cellValue = (value: unknown) => {
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value === null || value === undefined) return "";
  return String(value).slice(0, MAX_CELL_CHARS);
};

const safeSheetName = (value: unknown, index: number) => {
  const name = typeof value === "string" ? value.trim() : "";
  return (name || `Sheet ${index + 1}`).replaceAll(/[\\/*?:\[\]]/g, "-").slice(0, 31);
};

export const executeCreateExcel = async (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> => {
  if (!Array.isArray(args.sheets) || args.sheets.length === 0) {
    throw new Error("Excel 工作簿至少需要一个工作表");
  }
  if (args.sheets.length > MAX_SHEETS) throw new Error("Excel 工作表数量过多");

  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  for (const [sheetIndex, rawSheet] of args.sheets.entries()) {
    const sheet =
      rawSheet && typeof rawSheet === "object" ? (rawSheet as Record<string, unknown>) : {};
    if (!Array.isArray(sheet.rows)) throw new Error("Excel 工作表行数据格式无效");
    if (sheet.rows.length > MAX_ROWS) throw new Error("Excel 工作表行数过多");

    const rows = sheet.rows.map((rawRow) => {
      if (!Array.isArray(rawRow)) return [cellValue(rawRow)];
      if (rawRow.length > MAX_COLUMNS) throw new Error("Excel 工作表列数过多");
      return rawRow.map(cellValue);
    });
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const columnCount = Math.max(0, ...rows.map((row) => row.length));
    worksheet["!cols"] = Array.from({ length: columnCount }, (_, columnIndex) => ({
      wch: Math.min(
        40,
        Math.max(10, ...rows.slice(0, 100).map((row) => String(row[columnIndex] ?? "").length + 2)),
      ),
    }));
    if (rows.length > 1 && columnCount > 0) {
      worksheet["!autofilter"] = {
        ref: XLSX.utils.encode_range({ c: 0, r: 0 }, { c: columnCount - 1, r: rows.length - 1 }),
      };
    }

    let name = safeSheetName(sheet.name, sheetIndex);
    let suffix = 2;
    while (usedNames.has(name)) {
      const tail = ` ${suffix++}`;
      name = `${name.slice(0, 31 - tail.length)}${tail}`;
    }
    usedNames.add(name);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }

  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const filename = typeof args.filename === "string" ? args.filename : undefined;
  const file = await saveGeneratedFile({
    bytes: new Uint8Array(output),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: ".xlsx",
    fallbackName: "MarkAI 表格",
    filename,
    userId: context.userId,
  });

  return {
    content: {
      downloadUrl: file.url,
      filename: file.name,
      message: "Excel workbook created successfully.",
      sheets: args.sheets.length,
    },
    file,
  };
};
