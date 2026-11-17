import ExcelJS from "exceljs";

/** A spreadsheet to write: one or more sheets of typed columns. */
export interface ExportColumn {
  key: string;
  header: string;
  type: "text" | "money" | "number" | "date" | "datetime";
}

export interface ExportSheet {
  name: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
}

export interface ExportTable {
  title: string;
  /** Shown under the title: period, branch, time zone, truncation… */
  notes: string[];
  sheets: ExportSheet[];
}

const WIDTH: Record<ExportColumn["type"], number> = { text: 24, money: 16, number: 12, date: 13, datetime: 18 };

/** xlsx: one worksheet per sheet, plus an "About" sheet with the title and notes. */
export async function toXlsx(table: ExportTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TailorFlow";
  workbook.created = new Date();

  for (const sheet of table.sheets) {
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31));
    worksheet.columns = sheet.columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: WIDTH[column.type],
      ...(column.type === "money" ? { style: { numFmt: "#,##0.00" } } : {}),
    }));
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    for (const row of sheet.rows) worksheet.addRow(row);
  }

  const about = workbook.addWorksheet("About");
  about.addRow([table.title]).font = { bold: true, size: 13 };
  for (const note of table.notes) about.addRow([note]);
  about.getColumn(1).width = 80;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/**
 * A text value starting with = + - @ or a control character could run as a
 * formula when the file is opened in a spreadsheet — prefix it with '.
 * Plain numbers are left alone.
 */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV, with a byte-order mark so Excel reads UTF-8. Several sheets become sections. */
export function toCsv(table: ExportTable): Buffer {
  const lines: string[] = [];
  const multiple = table.sheets.length > 1;
  for (const sheet of table.sheets) {
    if (multiple) {
      if (lines.length > 0) lines.push("");
      lines.push(csvField(sheet.name));
    }
    lines.push(sheet.columns.map((column) => csvField(column.header)).join(","));
    for (const row of sheet.rows) lines.push(sheet.columns.map((column) => csvField(row[column.key])).join(","));
  }
  return Buffer.from(String.fromCharCode(0xfeff) + lines.join("\r\n") + "\r\n", "utf8");
}
