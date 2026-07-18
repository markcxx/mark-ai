import * as XLSX from "xlsx";

const DEFAULT_MAX_CHARS = 120_000;
const TRUNCATION_MARKER = "\n\n[表格内容过长，已截断]";
const PREVIEW_MAX_CELLS = 20_000;
const PREVIEW_MAX_COLUMNS = 50;
const PREVIEW_MAX_ROWS = 200;
const PREVIEW_MAX_CELL_CHARS = 500;

const normalizeCell = (value: unknown) =>
  String(value ?? "")
    .replaceAll("\0", "")
    .replace(/\r?\n/g, "<br>")
    .replaceAll("|", "\\|")
    .trim();

const normalizeSheetName = (value: string) =>
  value.replaceAll("\0", "").replace(/\r?\n/g, " ").trim();

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("\0", "")
    .slice(0, PREVIEW_MAX_CELL_CHARS)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll(/\r?\n/g, "<br />");

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

export const renderSpreadsheetPreview = (bytes: Uint8Array, fileName: string) => {
  const workbook = XLSX.read(Buffer.from(bytes), {
    cellDates: true,
    type: "buffer",
  });
  if (workbook.SheetNames.length === 0) throw new Error("Excel 文件中没有工作表");

  let remainingCells = PREVIEW_MAX_CELLS;
  let truncated = false;
  const sheets: string[] = [];
  const navigation: string[] = [];

  for (const [sheetIndex, sheetName] of workbook.SheetNames.entries()) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      blankrows: true,
      defval: "",
      header: 1,
      raw: false,
    });
    const columnCount = Math.min(
      PREVIEW_MAX_COLUMNS,
      Math.max(0, ...rows.map((row) => row.length)),
    );
    const affordableRows = columnCount > 0 ? Math.floor(remainingCells / columnCount) : 0;
    const visibleRows = rows.slice(0, Math.min(PREVIEW_MAX_ROWS, affordableRows));
    remainingCells -= visibleRows.length * columnCount;

    if (
      rows.length > visibleRows.length ||
      rows.some((row) => row.length > PREVIEW_MAX_COLUMNS) ||
      remainingCells <= 0
    ) {
      truncated = true;
    }

    const id = `sheet-${sheetIndex + 1}`;
    navigation.push(`<a href="#${id}">${escapeHtml(sheetName)}</a>`);
    const tableRows = visibleRows
      .map((row, rowIndex) => {
        const tag = rowIndex === 0 ? "th" : "td";
        const cells = Array.from({ length: columnCount }, (_, columnIndex) => {
          const value = escapeHtml(row[columnIndex]);
          return `<${tag}>${value || "&nbsp;"}</${tag}>`;
        }).join("");
        return `<tr><th class="row-number">${rowIndex + 1}</th>${cells}</tr>`;
      })
      .join("");

    sheets.push(`<section id="${id}">
      <h2>${escapeHtml(sheetName)}</h2>
      ${
        columnCount > 0 && visibleRows.length > 0
          ? `<div class="table-wrap"><table><tbody>${tableRows}</tbody></table></div>`
          : '<div class="empty">此工作表为空</div>'
      }
    </section>`);

    if (remainingCells <= 0) break;
  }

  if (sheets.length < workbook.SheetNames.length) truncated = true;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(fileName)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body { margin: 0; background: #f3f4f6; color: #27272a; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; }
      header { position: sticky; z-index: 10; top: 0; display: flex; overflow-x: auto; gap: 4px; padding: 10px 14px; border-bottom: 1px solid #e5e7eb; background: rgba(255,255,255,.94); backdrop-filter: blur(12px); }
      header a { flex: none; padding: 6px 10px; border-radius: 6px; color: #52525b; text-decoration: none; }
      header a:hover { background: #f3f4f6; color: #18181b; }
      main { padding: 18px; }
      section { margin: 0 auto 22px; scroll-margin-top: 64px; }
      h2 { margin: 0 0 10px; color: #18181b; font-size: 14px; font-weight: 600; }
      .table-wrap { overflow: auto; max-height: calc(100vh - 120px); border: 1px solid #dfe2e7; border-radius: 8px; background: white; }
      table { min-width: 100%; border-spacing: 0; border-collapse: separate; white-space: nowrap; }
      th, td { max-width: 420px; padding: 7px 10px; overflow: hidden; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; text-align: left; text-overflow: ellipsis; vertical-align: top; }
      tr:first-child > th:not(.row-number) { position: sticky; z-index: 2; top: 0; background: #f5f7f9; color: #27272a; font-weight: 600; }
      .row-number { position: sticky; z-index: 3; left: 0; width: 44px; min-width: 44px; background: #f7f8fa; color: #a1a1aa; font-weight: 400; text-align: center; }
      .empty, .notice { padding: 18px; border: 1px solid #e5e7eb; border-radius: 8px; background: white; color: #71717a; }
      .notice { margin: 0 auto 18px; border-color: #fde68a; background: #fffbeb; color: #a16207; }
    </style>
  </head>
  <body>
    <header>${navigation.join("")}</header>
    <main>
      ${truncated ? '<div class="notice">表格较大，在线预览仅展示部分工作表、行或列；下载文件可查看完整内容。</div>' : ""}
      ${sheets.join("")}
    </main>
  </body>
</html>`;
};
