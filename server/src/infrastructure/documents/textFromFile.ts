import ExcelJS from "exceljs";
import JSZip from "jszip";

/**
 * The text of an uploaded spreadsheet, Word document or text file, so an AI can read it. Tables stay tables
 * (cells separated by tabs). PDFs are NOT read here: they are often scans, so the AI reads them itself.
 */

/** The message is safe to show, and finishes the sentence "File 2 …". */
export class UnreadableFile extends Error {}

/** What an Office file may unpack to: they are zips, and a small one can unpack to gigabytes. */
const MAX_UNPACKED_BYTES = 15 * 1024 * 1024;
const MAX_COLUMNS = 40;
/** Stop reading a sheet well past what is sent on anyway. */
const MAX_TEXT = 200_000;

const DAMAGED = "couldn't be opened. It may be damaged or password protected.";
const TOO_BIG = "holds too much to read. Split it into smaller files.";

function unpack(entry: JSZip.JSZipObject, budget: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const stream = entry.nodeStream("nodebuffer");
    stream.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > budget) {
        stream.pause();
        reject(new UnreadableFile(TOO_BIG));
        return;
      }
      chunks.push(chunk);
    });
    stream.on("error", () => reject(new UnreadableFile(DAMAGED)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/** Opens an Office file, having unpacked every part once against the size limit. */
async function openOffice(buffer: Buffer): Promise<JSZip> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new UnreadableFile(DAMAGED);
  }
  let budget = MAX_UNPACKED_BYTES;
  for (const entry of Object.values(zip.files)) {
    if (!entry.dir) budget -= (await unpack(entry, budget)).length;
  }
  return zip;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (match, name: string) => {
    if (name.startsWith("#")) {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

async function wordText(buffer: Buffer): Promise<string> {
  const zip = await openOffice(buffer);
  const body = zip.file("word/document.xml");
  if (!body) throw new UnreadableFile(DAMAGED);
  const xml = (await unpack(body, MAX_UNPACKED_BYTES)).toString("utf8");
  return decodeEntities(
    xml
      // Text deleted with tracked changes, and field codes, are not what the page says.
      .replace(/<w:(delText|instrText)\b[^>]*>[^<]*<\/w:\1>/g, "")
      .replace(/<\/w:p>\s*<\/w:tc>/g, "</w:tc>") // a cell's last line doesn't end its row
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<\/w:tr>|<\/w:p>|<w:br\s*\/>/g, "\n")
      .replace(/<w:tab\s*\/>/g, "\t")
      .replace(/<[^>]+>/g, ""),
  );
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value !== "object") return String(value);
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
  if ("text" in value) return String(value.text);
  return ""; // an error, or a formula never calculated
}

async function excelText(buffer: Buffer): Promise<string> {
  await openOffice(buffer); // the size check, before ExcelJS unpacks it all into memory
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new UnreadableFile(DAMAGED);
  }
  const lines: string[] = [];
  let length = 0;
  workbook.eachSheet((sheet) => {
    const rows: string[] = [];
    sheet.eachRow((row) => {
      if (length > MAX_TEXT) return;
      const cells: string[] = [];
      row.eachCell((cell, column) => {
        if (column <= MAX_COLUMNS) cells[column - 1] = cellText(cell.value).replace(/\s+/g, " ").trim();
      });
      const line = Array.from(cells, (cell) => cell ?? "")
        .join("\t")
        .trimEnd();
      if (!line) return;
      rows.push(line);
      length += line.length;
    });
    if (rows.length) lines.push(`Sheet: ${sheet.name}`, ...rows, "");
  });
  return lines.join("\n");
}

/** CSV and text files: UTF-8, or the UTF-16 that Excel's "Unicode text" writes. */
function plainText(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString("utf16le");
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

export const TEXT_FILE_KINDS = {
  xlsx: "spreadsheet",
  docx: "Word document",
  csv: "spreadsheet (CSV)",
  txt: "text file",
} as const;
export type TextFileExtension = keyof typeof TEXT_FILE_KINDS;

export const isTextFile = (extension: string): extension is TextFileExtension => extension in TEXT_FILE_KINDS;

export async function textFromFile(extension: TextFileExtension, buffer: Buffer): Promise<string> {
  const text =
    extension === "xlsx" ? await excelText(buffer) : extension === "docx" ? await wordText(buffer) : plainText(buffer);
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
