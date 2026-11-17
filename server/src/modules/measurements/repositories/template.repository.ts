import { In, type Repository } from "typeorm";
import { AppDataSource } from "../../../infrastructure/database/dataSource";
import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository, escapeLike, likePattern } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type {
  ListTemplatesParams,
  MeasurementFieldRecord,
  MeasurementTemplateDTO,
  MeasurementTemplateRecord,
  TemplateFieldInput,
} from "../dto/measurement.dto";
import { MeasurementField } from "../entities/measurementField.entity";
import { MeasurementTemplate } from "../entities/measurementTemplate.entity";

function toRecord(row: MeasurementTemplate): MeasurementTemplateRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    description: row.description ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toFieldRecord(row: MeasurementField): MeasurementFieldRecord {
  return { id: row.id, name: row.name, position: row.position, isRequired: row.isRequired };
}

/** Templates and their fields: one aggregate, one repository. */
export class TemplateRepository extends BaseRepository<MeasurementTemplate> {
  static Instance = new TemplateRepository();

  private constructor() {
    super(MeasurementTemplate);
  }

  private fields(tx?: Tx): Repository<MeasurementField> {
    return (tx ?? AppDataSource.manager).getRepository(MeasurementField);
  }

  /** Fields for a bounded set of templates in ONE query (no N+1). Index: measurement_fields(template_id, position). */
  private async fieldsFor(templateIds: string[], tx?: Tx): Promise<Map<string, MeasurementFieldRecord[]>> {
    const byTemplate = new Map<string, MeasurementFieldRecord[]>();
    if (templateIds.length === 0) return byTemplate;
    // Bounded: at most one page of templates × MEASUREMENT_LIMITS.maxFields rows.
    const rows = await this.fields(tx).find({ where: { templateId: In(templateIds) }, order: { position: "ASC" } });
    for (const row of rows) {
      const list = byTemplate.get(row.templateId) ?? [];
      list.push(toFieldRecord(row));
      byTemplate.set(row.templateId, list);
    }
    return byTemplate;
  }

  /** Tenant scope in the query itself (Backend Guide §13.4). */
  async findInBusiness(id: string, businessId: string, tx?: Tx): Promise<MeasurementTemplateDTO | null> {
    const row = await this.repo(tx).findOne({ where: { id, businessId } });
    if (!row) return null;
    const fields = await this.fieldsFor([row.id], tx);
    return { ...toRecord(row), fields: fields.get(row.id) ?? [] };
  }

  /** Same name ignoring case, among one business's live templates — a small scoped set. */
  async findByName(
    businessId: string,
    name: string,
    exceptId?: string,
    tx?: Tx,
  ): Promise<MeasurementTemplateRecord | null> {
    const qb = this.repo(tx)
      .createQueryBuilder("t")
      .where("t.businessId = :businessId", { businessId })
      .andWhere("t.name ILIKE :name", { name: escapeLike(name) });
    if (exceptId) qb.andWhere("t.id <> :exceptId", { exceptId });
    const row = await qb.getOne();
    return row ? toRecord(row) : null;
  }

  /** Index: UQ_measurement_templates_name_live (business_id, name). */
  async listForBusiness(params: ListTemplatesParams): Promise<Paginated<MeasurementTemplateDTO>> {
    const qb = this.repo()
      .createQueryBuilder("t")
      .where("t.businessId = :businessId", { businessId: params.businessId });
    if (params.search) qb.andWhere("t.name ILIKE :term", { term: likePattern(params.search) });
    qb.orderBy("t.name", "ASC").addOrderBy("t.id", "ASC");

    const page = await this.paginate(qb, params.page, params.limit);
    const fields = await this.fieldsFor(page.data.map((row) => row.id));
    return {
      data: page.data.map((row) => ({ ...toRecord(row), fields: fields.get(row.id) ?? [] })),
      meta: page.meta,
    };
  }

  async createTemplate(
    data: { businessId: string; name: string; description?: string | null },
    fields: TemplateFieldInput[],
    tx: Tx,
  ): Promise<MeasurementTemplateDTO> {
    const created = await this.create(data, tx);
    await this.insertFields(created.id, fields, tx);
    return (await this.findInBusiness(created.id, data.businessId, tx))!;
  }

  async updateTemplate(
    id: string,
    businessId: string,
    data: { name?: string; description?: string | null },
    tx: Tx,
  ): Promise<void> {
    await this.repo(tx).update({ id, businessId }, { ...data, updatedAt: new Date() });
  }

  /**
   * Swaps a template's field list. Safe for history: recorded measurements keep
   * their own copy of each name and never point at these rows.
   */
  async replaceFields(templateId: string, fields: TemplateFieldInput[], tx: Tx): Promise<void> {
    await this.fields(tx).softDelete({ templateId });
    await this.insertFields(templateId, fields, tx);
  }

  async removeInBusiness(id: string, businessId: string, tx: Tx): Promise<void> {
    await this.fields(tx).softDelete({ templateId: id });
    await this.repo(tx).softDelete({ id, businessId });
  }

  private async insertFields(templateId: string, fields: TemplateFieldInput[], tx: Tx): Promise<void> {
    if (fields.length === 0) return;
    await this.fields(tx).insert(
      fields.map((field, position) => ({ templateId, name: field.name, isRequired: field.isRequired, position })),
    );
  }
}
