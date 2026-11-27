import { shrinkPhoto } from "./shrinkPhoto";

/** What Snap a record can read, and how each is made ready to send (server: FILE_TYPES.record). */
const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "bmp"];

const DOCUMENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  csv: "text/csv",
  txt: "text/plain",
};

/** For the file chooser. */
export const RECORD_ACCEPT = "image/*,.pdf,.xlsx,.docx,.csv,.txt";
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const extensionOf = (name: string) => (name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "");

export const isPhoto = (file: File) =>
  file.type.startsWith("image/") || PHOTO_EXTENSIONS.includes(extensionOf(file.name));

/** Why a chosen file can't be used, or null when it can. Photos are shrunk before sending, so any size is fine. */
export function recordFileProblem(file: File): string | null {
  if (isPhoto(file)) return null;
  const extension = extensionOf(file.name);
  if (extension === "xls") return `${file.name} is an old Excel file. Save it as .xlsx, then add it.`;
  if (extension === "doc") return `${file.name} is an old Word file. Save it as .docx, then add it.`;
  if (!(extension in DOCUMENT_TYPES)) {
    return `${file.name} can't be read. Use a photo, PDF, Excel, Word, CSV or text file.`;
  }
  if (file.size > MAX_DOCUMENT_BYTES) return `${file.name} is over 5 MB. Split it into smaller files.`;
  return null;
}

/** Photos are shrunk to a JPEG. Documents get a plain name (yours isn't needed) and the type the server expects. */
export async function prepareRecordFile(file: File, index: number): Promise<File> {
  if (isPhoto(file)) return shrinkPhoto(file, index);
  const extension = extensionOf(file.name);
  return new File([file], `record-${index + 1}.${extension}`, { type: DOCUMENT_TYPES[extension] });
}
