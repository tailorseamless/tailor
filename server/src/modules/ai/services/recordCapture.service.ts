import type { AiImage } from "../../../infrastructure/ai/aiProvider";
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

/**
 * Snap a record: photos of paper records → drafts of customers, measurements and orders. NOTHING is saved
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

  async draft(actor: Actor, photos: Express.Multer.File[]): Promise<RecordCaptureDraftDTO> {
    // Fail before spending anything when there is nothing to read.
    if (!photos.length) {
      throw AppError.unprocessable("Add a photo of the record first", [{ field: "photos", message: "Add a photo" }]);
    }
    if (photos.length > CAPTURE_LIMITS.photos) {
      throw AppError.unprocessable(`Use at most ${CAPTURE_LIMITS.photos} photos at a time`);
    }

    const business = await this.businesses.mine(actor);
    const templateRows = (await this.templates.list(actor, { page: 1, limit: 100 })).data;
    const templates = templateRows.map((t) => ({
      id: t.id,
      name: t.name,
      fields: [...t.fields].sort((a, b) => a.position - b.position).map((f) => f.name),
    }));
    const today = localDay(new Date(), business.timeZone);

    const images: AiImage[] = photos.map((photo) => ({
      mimeType: MIME[extensionOf(photo.originalname)] ?? "image/jpeg",
      data: photo.buffer.toString("base64"),
    }));

    const result = await this.ai.generateJson(actor, {
      feature: "record_capture",
      system: CAPTURE_SYSTEM_PROMPT,
      prompt: buildCapturePrompt({
        unit: business.measurementUnit,
        currency: business.currency,
        timeZone: business.timeZone,
        today,
        templates,
        photoCount: images.length,
      }),
      images,
      imagesRequired: true,
      schema: captureReplySchema,
      schemaName: "record_capture",
      jsonSchema: CAPTURE_JSON_SCHEMA,
      maxOutputTokens: 16_000,
      timeoutMs: CAPTURE_TIMEOUT_MS,
      rejectionHints: [
        {
          includes: "records",
          message: "The AI couldn't make sense of these photos. Try again with a clearer, well-lit photo of one page.",
        },
      ],
    });

    const { records, dropped } = shapeCapture(result.data, { templates, unit: business.measurementUnit, today });
    const status = await this.ai.status(actor, "record_capture");

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
      caveats: [...dropped, ...result.data.caveats.map((t) => fit(t, 300)).filter(Boolean)].slice(0, 20),
      provider: result.provider,
      providerLabel: result.providerLabel,
      model: result.model,
      remainingToday: status.remainingToday,
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
