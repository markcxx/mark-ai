import * as XLSX from "xlsx";

const DEFAULT_MAX_CHARS = 120_000;
const TRUNCATION_MARKER = "\n\n[表格内容过长，已截断]";

const normalizeCell = (value: unknown) =>
  String(value ?? "")
    .replaceAll("\0", "")
    .replace(/\r?\n/g, "<br>")
    .replaceAll("|", "\\|")
    .trim();

const normalizeSheetName = (value: string) =>
  value.replaceAll("\0", "").replace(/\r?\n/g, " ").trim();

const hasContent = (row: unknown[]) => row.some((cell) => normalizeCell(cell).length > 0);

const uniqueHeaders = (row: unknown[], columnCount: number) => {
  const occurrences = new Map<string, number>();

  return Array.from({ length: columnCount }, (_, index) => {
    const base = normalizeCell(row[index]) || `列 ${XLSX.utils.encode_col(index)}`;
    const count = (occurrences.get(base) || 0) + 1;
    occurrences.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
};

export const extractSpreadsheetContent = (bytes: Uint8Array, maxChars = DEFAULT_MAX_CHARS) => {
  const workbook = XLSX.read(Buffer.from(bytes), {
    cellDates: true,
    type: "buffer",
  });
  if (workbook.SheetNames.length === 0) throw new Error("Excel 文件中没有工作表");

  const parts: string[] = [];
  let usedChars = 0;
  let truncated = false;

  const append = (line = "") => {
    const prefix = parts.length > 0 ? "\n" : "";
    const next = `${prefix}${line}`;
    const available = maxChars - TRUNCATION_MARKER.length - usedChars;

    if (next.length > available) {
      if (available > 0) {
        parts.push(next.slice(0, available));
        usedChars += available;
      }
      truncated = true;
      return false;
    }

    parts.push(next);
    usedChars += next.length;
    return true;
  };

  sheetLoop: for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils
      .sheet_to_json<unknown[]>(worksheet, {
        blankrows: false,
        defval: "",
        header: 1,
        raw: false,
      })
      .filter(hasContent);

    if (parts.length > 0 && !append()) break;
    if (!append(`## 工作表：${normalizeSheetName(sheetName) || "未命名"}`)) break;

    if (rows.length === 0) {
      if (!append("[工作表为空]")) break;
      continue;
    }

    const columnCount = Math.max(...rows.map((row) => row.length));
    const headers = uniqueHeaders(rows[0], columnCount);
    if (!append(`| ${headers.join(" | ")} |`)) break;
    if (!append(`| ${headers.map(() => "---").join(" | ")} |`)) break;

    for (const row of rows.slice(1)) {
      const cells = Array.from({ length: columnCount }, (_, index) => normalizeCell(row[index]));
      if (!append(`| ${cells.join(" | ")} |`)) break sheetLoop;
    }
  }

  const content = parts.join("");
  if (!content.trim()) throw new Error("Excel 文件中没有提取到可读数据");
  return truncated ? `${content}${TRUNCATION_MARKER}` : content;
};
