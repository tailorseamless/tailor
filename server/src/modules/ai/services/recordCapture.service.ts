import type { AiDocument, AiImage } from "../../../infrastructure/ai/aiProvider";
import {
  isTextFile,
  TEXT_FILE_KINDS,
  textFromFile,
  UnreadableFile,
} from "../../../infrastructure/documents/textFromFile";
import { AppError } from "../../../shared/errors/AppError";
import type { Actor } from "../../../shared/services/access.service";
import { extensionOf } from "../../../shared/utils/fileTypes";
import { localDay } from "../../../shared/utils/timezone";
import { BusinessService } from "../../businesses/services/business.service";
import { CustomerService } from "../../customers/services/customer.service";
import { MeasurementTemplateService } from "../../measurements/services/template.service";
import {
  CAPTURE_JSON_SCHEMA,
  CAPTURE_LIMITS,
  CAPTURE_SYSTEM_PROMPT,
  buildCapturePrompt,
  captureReplySchema,
  shapeCapture,
  type CaptureRecordDraft,
} from "../domain/recordCapture";
import { fit } from "../domain/lenient";
import type { CaptureMatchDTO, RecordCaptureDraftDTO } from "../dto/ai.dto";
import { AiService } from "./ai.service";

const MIME: Record<string, AiImage["mimeType"]> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Reading a full page of handwriting can take a while; the client waits a little longer than this. */
const CAPTURE_TIMEOUT_MS = 180_000;

/** Page objects in a PDF. Best effort: pages packed into compressed streams aren't seen (the size limit still holds). */
const pdfPageCount = (buffer: Buffer): number => buffer.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;

interface Material {
  images: AiImage[];
  documents: AiDocument[];
  files: { kind: string; text: string }[];
  /** What the person should know about reading the files themselves. */
  notes: string[];
}

/** Sorts what was uploaded into photos, PDFs and text, and says plainly which file can't be used. */
async function readMaterial(uploads: Express.Multer.File[]): Promise<Material> {
  const material: Material = { images: [], documents: [], files: [], notes: [] };
  const refuse = (message: string) => AppError.unprocessable(message, [{ field: "files", message }]);
  let room: number = CAPTURE_LIMITS.fileChars;
  let cut = false;

  for (const [i, upload] of uploads.entries()) {
    const extension = extensionOf(upload.originalname);
    const label = `File ${i + 1}`;
    if (MIME[extension]) {
      material.images.push({ mimeType: MIME[extension], data: upload.buffer.toString("base64") });
    } else if (extension === "pdf") {
      if (pdfPageCount(upload.buffer) > CAPTURE_LIMITS.pdfPages) {
        throw refuse(`${label} has more than ${CAPTURE_LIMITS.pdfPages} pages. Split it and add one part at a time.`);
      }
      material.documents.push({
        mimeType: "application/pdf",
        data: upload.buffer.toString("base64"),
        filename: `record-${i + 1}.pdf`,
      });
    } else if (isTextFile(extension)) {
      let text: string;
      try {
        text = await textFromFile(extension, upload.buffer);
      } catch (err) {
        if (err instanceof UnreadableFile) throw refuse(`${label} ${err.message}`);
        throw err;
      }
      if (!text) {
        material.notes.push(`${label} is empty.`);
        continue;
      }
      if (text.length > room) {
        cut = true;
        text = text.slice(0, room);
      }
      room -= text.length;
      if (text) material.files.push({ kind: TEXT_FILE_KINDS[extension], text });
    }
  }
  if (cut) material.notes.push("Only the first part of a long file was read. Split it and add the rest in another go.");
  if (!material.images.length && !material.documents.length && !material.files.length) {
    throw refuse("There is nothing to read in what you added.");
  }
  return material;
}

/**
 * Snap a record: photos or files of records → drafts of customers, measurements and orders. NOTHING is saved
 * here: the person checks the drafts and saves them through the ordinary customer, measurement and order
 * endpoints. Everything it reads (templates, existing customers) goes through the caller's access checks.
 */
export class RecordCaptureService {
  static Instance = new RecordCaptureService();

  private constructor(
    private readonly ai = AiService.Instance,
    private readonly businesses = BusinessService.Instance,
    private readonly templates = MeasurementTemplateService.Instance,
    private readonly customers = CustomerService.Instance,
  ) {}

  async draft(actor: Actor, uploads: Express.Multer.File[]): Promise<RecordCaptureDraftDTO> {
    // Fail before spending anything when there is nothing to read.
    if (!uploads.length) {
      throw AppError.unprocessable("Add a photo or a file first", [{ field: "files", message: "Add a file" }]);
    }
    if (uploads.length > CAPTURE_LIMITS.files) {
      throw AppError.unprocessable(`Use at most ${CAPTURE_LIMITS.files} photos or files at a time`);
    }
    const material = await readMaterial(uploads);

    const business = await this.businesses.mine(actor);
    const templateRows = (await this.templates.list(actor, { page: 1, limit: 100 })).data;
    const templates = templateRows.map((t) => ({
      id: t.id,
      name: t.name,
      fields: [...t.fields].sort((a, b) => a.position - b.position).map((f) => f.name),
    }));
    const today = localDay(new Date(), business.timeZone);

    const result = await this.ai.generateJson(actor, {
      feature: "record_capture",
      system: CAPTURE_SYSTEM_PROMPT,
      prompt: buildCapturePrompt({
        unit: business.measurementUnit,
        currency: business.currency,
        timeZone: business.timeZone,
        today,
        templates,
        photoCount: material.images.length,
        pdfCount: material.documents.length,
        files: material.files,
      }),
      images: material.images,
      documents: material.documents,
      imagesRequired: true,
      schema: captureReplySchema,
      schemaName: "record_capture",
      jsonSchema: CAPTURE_JSON_SCHEMA,
      maxOutputTokens: 16_000,
      timeoutMs: CAPTURE_TIMEOUT_MS,
      rejectionHints: [
        {
          includes: "records",
          message: "The AI couldn't make sense of this. Try a clearer, well-lit photo of one page, or a simpler file.",
        },
      ],
    });

    const { records, dropped } = shapeCapture(result.data, { templates, unit: business.measurementUnit, today });

    return {
      summary: fit(result.data.summary, 300),
      records: await Promise.all(
        records.map(async (record) => ({
          ...record,
          measurement: record.measurement && {
            ...record.measurement,
            templateId:
              record.measurement.templateIndex === null ? null : templates[record.measurement.templateIndex].id,
            templateName:
              record.measurement.templateIndex === null ? null : templates[record.measurement.templateIndex].name,
          },
          match: await this.match(actor, record),
        })),
      ),
      unreadable: result.data.unreadable
        .map((t) => fit(t, 300))
        .filter(Boolean)
        .slice(0, 20),
      caveats: [...material.notes, ...dropped, ...result.data.caveats.map((t) => fit(t, 300)).filter(Boolean)].slice(
        0,
        20,
      ),
      tokensUsed: result.tokensUsed,
      tokensLeft: await this.ai.tokensLeft(actor),
    };
  }

  /**
   * An existing customer this record is probably about: the same phone number (a strong match), else exactly
   * the same name (a suggestion only). Uses the ordinary, tenant-scoped customer search.
   */
  private async match(actor: Actor, record: CaptureRecordDraft): Promise<CaptureMatchDTO | null> {
    const { phone, fullName } = record.customer;
    if (phone) {
      const found = await this.customers.list(actor, { search: phone, page: 1, limit: 5, sort: "recent" });
      const same = found.data.find((c) => c.phone === phone);
      if (same) return { id: same.id, fullName: same.fullName, phone: same.phone, by: "phone" };
    }
    if (fullName.length >= 2) {
      const found = await this.customers.list(actor, { search: fullName, page: 1, limit: 10, sort: "recent" });
      const name = fullName.trim().toLowerCase();
      const same = found.data.find((c) => c.fullName.trim().toLowerCase() === name);
      if (same) return { id: same.id, fullName: same.fullName, phone: same.phone, by: "name" };
    }
    return null;
  }
}
