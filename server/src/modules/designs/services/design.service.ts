import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import type { AuditAction } from "../../activity/dto/activity.dto";
import { ActivityService } from "../../activity/services/activity.service";
import type { ImageRecord, IncomingFile } from "../../media/dto/media.dto";
import { ImageRepository } from "../../media/repositories/image.repository";
import { ImageService } from "../../media/services/image.service";
import type { DesignDTO, DesignRecord, DesignSummaryDTO, PublicDesignDTO } from "../dto/design.dto";
import { DesignRepository } from "../repositories/design.repository";
import type { CreateDesignInput, ListDesignsQuery, UpdateDesignInput } from "../validators/design.schema";

const withImages = (design: DesignRecord, images: ImageRecord[]): DesignDTO => ({
  ...design,
  images,
  coverUrl: images[0]?.url ?? null,
});

/** The design catalogue (PRD §4.5). */
export class DesignService {
  static Instance = new DesignService();

  private constructor(
    private readonly designs = DesignRepository.Instance,
    private readonly imageRows = ImageRepository.Instance,
    private readonly images = ImageService.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  async list(actor: Actor, query: ListDesignsQuery): Promise<Paginated<DesignDTO>> {
    const page = await this.designs.listForBusiness({ ...query, businessId: actor.businessId }); // tenant scope, always
    const images = await this.imageRows.listForDesigns(page.data.map((design) => design.id));
    return { data: page.data.map((design) => withImages(design, images.get(design.id) ?? [])), meta: page.meta };
  }

  categories(actor: Actor): Promise<string[]> {
    return this.designs.categories(actor.businessId);
  }

  /** Another business's design is a 404: existence must not leak. */
  async detail(actor: Actor, id: string): Promise<DesignDTO> {
    const design = await this.find(actor, id);
    return withImages(design, await this.images.list({ kind: "design", id }));
  }

  async create(actor: Actor, input: CreateDesignInput): Promise<DesignDTO> {
    return runInTransaction(async (tx) => {
      const design = await this.designs.createDesign(
        {
          businessId: actor.businessId,
          name: input.name,
          description: input.description ?? null,
          category: input.category ?? null,
          priceMin: input.priceMin ?? null,
          priceMax: input.priceMax ?? null,
          visibility: input.visibility,
          isFavourite: input.isFavourite,
          createdBy: actor.id,
        },
        tx,
      );
      await this.audit(actor, "design.created", design.id, {}, tx);
      return withImages(design, []);
    });
  }

  async update(actor: Actor, id: string, input: UpdateDesignInput): Promise<DesignDTO> {
    await runInTransaction(async (tx) => {
      const current = await this.find(actor, id, tx);
      // The schema only sees what was sent; changing one end of the range must still leave a valid range.
      const min = input.priceMin !== undefined ? input.priceMin : current.priceMin;
      const max = input.priceMax !== undefined ? input.priceMax : current.priceMax;
      if (min !== null && max !== null && min > max) {
        throw AppError.unprocessable("The highest price can't be lower than the lowest price", [
          { field: input.priceMin !== undefined ? "priceMin" : "priceMax", message: "Out of range" },
        ]);
      }
      await this.designs.updateDesign(id, actor.businessId, input, tx);
      await this.audit(actor, "design.updated", id, { fields: Object.keys(input) }, tx);
    });
    return this.detail(actor, id);
  }

  /** Switches several saved designs on for customers at once. Ids that aren't this business's are ignored. */
  async show(actor: Actor, ids: string[]): Promise<{ shown: number }> {
    return runInTransaction(async (tx) => {
      const changed = await this.designs.showToCustomers([...new Set(ids)], actor.businessId, tx);
      for (const id of changed) await this.audit(actor, "design.updated", id, { fields: ["visibility"] }, tx);
      return { shown: changed.length };
    });
  }

  /**
   * Switches on every hidden design that has a photo, for the platform admin; returns their ids. The caller
   * checks who may do this and writes the audit entry.
   */
  async showAllFor(businessId: string, tx: Tx): Promise<string[]> {
    return this.designs.showToCustomers(await this.designs.hiddenWithPhoto(businessId, tx), businessId, tx);
  }

  /** A soft delete. Orders that used the design keep pointing at it; its pictures stay for them. */
  async remove(actor: Actor, id: string): Promise<void> {
    await runInTransaction(async (tx) => {
      await this.find(actor, id, tx);
      await this.designs.removeInBusiness(id, actor.businessId, tx);
      await this.audit(actor, "design.deleted", id, {}, tx);
    });
  }

  async addImages(actor: Actor, id: string, files: IncomingFile[]): Promise<DesignDTO> {
    const design = await this.find(actor, id);
    return withImages(design, await this.images.add(actor, { kind: "design", id }, files));
  }

  async removeImage(actor: Actor, id: string, imageId: string): Promise<DesignDTO> {
    await this.find(actor, id);
    await this.images.remove(actor, { kind: "design", id }, imageId);
    return this.detail(actor, id);
  }

  /** What customers may see: designs marked `customers`, with their pictures. */
  async forCustomers(businessId: string, limit: number): Promise<PublicDesignDTO[]> {
    const page = await this.designs.listForBusiness({ businessId, page: 1, limit, visibility: "customers" });
    const images = await this.imageRows.listForDesigns(page.data.map((design) => design.id));
    return page.data.map((design) => ({
      id: design.id,
      name: design.name,
      description: design.description,
      category: design.category,
      priceMin: design.priceMin,
      priceMax: design.priceMax,
      images: (images.get(design.id) ?? []).map(({ url, width, height }) => ({ url, width, height })),
    }));
  }

  /**
   * The id back when this is a design the business shows customers; otherwise null. For links that arrive from a
   * public page, so a guessed or stale id is dropped quietly and never reveals what exists.
   */
  async shownDesignId(businessId: string, id: string | null | undefined): Promise<string | null> {
    if (!id) return null;
    const design = await this.designs.findInBusiness(id, businessId);
    return design?.visibility === "customers" ? design.id : null;
  }

  /** Name, price range and first picture of each design, by id. Designs that are gone are simply missing. */
  async summaries(businessId: string, ids: string[]): Promise<Map<string, DesignSummaryDTO>> {
    const rows = await this.designs.findManyInBusiness([...new Set(ids)], businessId);
    const images = await this.imageRows.listForDesigns(rows.map((design) => design.id));
    return new Map(
      rows.map((design) => [
        design.id,
        {
          id: design.id,
          name: design.name,
          category: design.category,
          priceMin: design.priceMin,
          priceMax: design.priceMax,
          coverUrl: images.get(design.id)?.[0]?.url ?? null,
        },
      ]),
    );
  }

  private async find(actor: Actor, id: string, tx?: Tx): Promise<DesignRecord> {
    const design = await this.designs.findInBusiness(id, actor.businessId, tx);
    if (!design) throw AppError.notFound("Design not found");
    return design;
  }

  private audit(actor: Actor, action: AuditAction, id: string, payload: Record<string, unknown>, tx: Tx) {
    return this.activity.audit(
      { businessId: actor.businessId, actorId: actor.id, action, entityType: "design", entityId: id, payload },
      tx,
    );
  }
}
