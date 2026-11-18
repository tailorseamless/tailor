import { In } from "typeorm";
import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { CustomerMeasurementRecord, ListMeasurementsParams } from "../dto/measurement.dto";
import { CustomerMeasurement } from "../entities/customerMeasurement.entity";

function toRecord(row: CustomerMeasurement): CustomerMeasurementRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    customerId: row.customerId,
    templateId: row.templateId ?? null,
    templateName: row.templateName ?? null,
    unit: row.unit,
    measuredOn: row.measuredOn,
    notes: row.notes ?? null,
    values: row.entries ?? [],
    source: row.source ?? "staff",
    recordedBy: row.recordedBy ?? null,
    createdAt: row.createdAt,
  };
}

export class CustomerMeasurementRepository extends BaseRepository<CustomerMeasurement> {
  static Instance = new CustomerMeasurementRepository();

  private constructor() {
    super(CustomerMeasurement);
  }

  /** Tenant AND customer in the query itself: another customer's record is simply not found. */
  async findForCustomer(
    id: string,
    customerId: string,
    businessId: string,
    tx?: Tx,
  ): Promise<CustomerMeasurementRecord | null> {
    const row = await this.repo(tx).findOne({ where: { id, customerId, businessId } });
    return row ? toRecord(row) : null;
  }

  /** How many of these ids are live measurement records of THIS customer in THIS business. */
  countForCustomer(ids: string[], customerId: string, businessId: string, tx?: Tx): Promise<number> {
    if (ids.length === 0) return Promise.resolve(0);
    return this.repo(tx).count({ where: { id: In(ids), customerId, businessId } });
  }

  /** A customer's history, newest first. Index: customer_measurements(business_id, customer_id, measured_on). */
  async listForCustomer(params: ListMeasurementsParams): Promise<Paginated<CustomerMeasurementRecord>> {
    const qb = this.repo()
      .createQueryBuilder("m")
      .where("m.businessId = :businessId", { businessId: params.businessId })
      .andWhere("m.customerId = :customerId", { customerId: params.customerId });
    if (params.templateId) qb.andWhere("m.templateId = :templateId", { templateId: params.templateId });
    qb.orderBy("m.measuredOn", "DESC").addOrderBy("m.createdAt", "DESC").addOrderBy("m.id", "DESC");

    const page = await this.paginate(qb, params.page, params.limit);
    return { data: page.data.map(toRecord), meta: page.meta };
  }

  async createMeasurement(
    data: Omit<CustomerMeasurementRecord, "id" | "createdAt">,
    tx?: Tx,
  ): Promise<CustomerMeasurementRecord> {
    const { values, ...rest } = data;
    return toRecord(await this.create({ ...rest, entries: values }, tx));
  }

  async removeForCustomer(id: string, customerId: string, businessId: string, tx?: Tx): Promise<void> {
    await this.repo(tx).softDelete({ id, customerId, businessId });
  }
}
