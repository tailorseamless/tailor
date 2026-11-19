import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { ActivityService } from "../../activity/services/activity.service";
import { DEFAULT_MEASUREMENT_TEMPLATES } from "../domain/defaultTemplates";
import type { MeasurementTemplateDTO } from "../dto/measurement.dto";
import { TemplateRepository } from "../repositories/template.repository";
import type { CreateTemplateInput, ListTemplatesQuery, UpdateTemplateInput } from "../validators/measurement.schema";

export class MeasurementTemplateService {
  static Instance = new MeasurementTemplateService();

  private constructor(
    private readonly templates = TemplateRepository.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  list(actor: Actor, query: ListTemplatesQuery): Promise<Paginated<MeasurementTemplateDTO>> {
    return this.templates.listForBusiness({ ...query, businessId: actor.businessId }); // tenant scope, always
  }

  async detail(actor: Actor, id: string): Promise<MeasurementTemplateDTO> {
    const template = await this.templates.findInBusiness(id, actor.businessId);
    if (!template) throw AppError.notFound("Template not found");
    return template;
  }

  async create(actor: Actor, input: CreateTemplateInput): Promise<MeasurementTemplateDTO> {
    return runInTransaction(async (tx) => {
      await this.assertNameIsFree(actor.businessId, input.name, undefined, tx);
      const template = await this.templates.createTemplate(
        { businessId: actor.businessId, name: input.name, description: input.description ?? null },
        input.fields,
        tx,
      );
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "measurement_template.created",
          entityType: "measurement_template",
          entityId: template.id,
        },
        tx,
      );
      return template;
    });
  }

  /** Changing a template never changes measurements already recorded with it. */
  async update(actor: Actor, id: string, input: UpdateTemplateInput): Promise<MeasurementTemplateDTO> {
    const { fields, ...details } = input;
    return runInTransaction(async (tx) => {
      const existing = await this.templates.findInBusiness(id, actor.businessId, tx);
      if (!existing) throw AppError.notFound("Template not found");
      if (details.name) await this.assertNameIsFree(actor.businessId, details.name, id, tx);

      await this.templates.updateTemplate(id, actor.businessId, details, tx);
      if (fields) await this.templates.replaceFields(id, fields, tx);
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "measurement_template.updated",
          entityType: "measurement_template",
          entityId: id,
          payload: { fields: Object.keys(input) },
        },
        tx,
      );
      return (await this.templates.findInBusiness(id, actor.businessId, tx))!;
    });
  }

  async remove(actor: Actor, id: string): Promise<void> {
    await runInTransaction(async (tx) => {
      const existing = await this.templates.findInBusiness(id, actor.businessId, tx);
      if (!existing) throw AppError.notFound("Template not found");
      await this.templates.removeInBusiness(id, actor.businessId, tx);
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "measurement_template.deleted",
          entityType: "measurement_template",
          entityId: id,
        },
        tx,
      );
    });
  }

  /** Gives a brand-new business its starter templates, inside the registration transaction. */
  async seedDefaults(businessId: string, tx: Tx): Promise<void> {
    for (const template of DEFAULT_MEASUREMENT_TEMPLATES) {
      await this.templates.createTemplate(
        { businessId, name: template.name },
        template.fields.map((field) => ({ ...field, isRequired: false })),
        tx,
      );
    }
  }

  private async assertNameIsFree(businessId: string, name: string, exceptId: string | undefined, tx: Tx) {
    if (await this.templates.findByName(businessId, name, exceptId, tx)) {
      throw AppError.conflict("A template with this name already exists", [{ field: "name", message: "duplicate" }]);
    }
  }
}
