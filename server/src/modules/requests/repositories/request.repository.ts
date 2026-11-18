import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { AppointmentRequestRecord, ListRequestsParams, NewRequestInput, RequestStatus } from "../dto/request.dto";
import { AppointmentRequest } from "../entities/appointmentRequest.entity";

function toRecord(row: AppointmentRequest): AppointmentRequestRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    customerId: row.customerId ?? null,
    source: row.source,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email ?? null,
    type: row.type,
    preferredStartsAt: row.preferredStartsAt,
    note: row.note ?? null,
    designId: row.designId ?? null,
    measurements: row.measurements?.length ? row.measurements : null,
    measurementUnit: row.measurementUnit ?? null,
    status: row.status,
    appointmentId: row.appointmentId ?? null,
    decidedBy: row.decidedBy ?? null,
    decidedAt: row.decidedAt ?? null,
    decisionNote: row.decisionNote ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class RequestRepository extends BaseRepository<AppointmentRequest> {
  static Instance = new RequestRepository();

  private constructor() {
    super(AppointmentRequest);
  }

  async findInBusiness(id: string, businessId: string, tx?: Tx): Promise<AppointmentRequestRecord | null> {
    const row = await this.repo(tx).findOne({ where: { id, businessId } });
    return row ? toRecord(row) : null;
  }

  /** Locked: accepting and declining the same request at once queue up (Backend Guide §8.4). */
  async findForUpdate(id: string, businessId: string, tx: Tx): Promise<AppointmentRequestRecord | null> {
    const row = await this.repo(tx)
      .createQueryBuilder("r")
      .setLock("pessimistic_write")
      .where("r.id = :id AND r.businessId = :businessId", { id, businessId })
      .getOne();
    return row ? toRecord(row) : null;
  }

  /** Pending first in the inbox: oldest waiting first. Index: appointment_requests(business_id, status, created_at). */
  async listForBusiness(params: ListRequestsParams): Promise<Paginated<AppointmentRequestRecord>> {
    const qb = this.repo()
      .createQueryBuilder("r")
      .where("r.businessId = :businessId", { businessId: params.businessId });
    if (params.status) qb.andWhere("r.status = :status", { status: params.status });
    if (params.customerId) qb.andWhere("r.customerId = :customerId", { customerId: params.customerId });
    qb.orderBy("r.status = 'pending'", "DESC")
      .addOrderBy("r.createdAt", params.status === "pending" ? "ASC" : "DESC")
      .addOrderBy("r.id", "ASC");
    const page = await this.paginate(qb, params.page, params.limit);
    return { data: page.data.map(toRecord), meta: page.meta };
  }

  /** Index: appointment_requests(business_id, phone, status). */
  countPendingForPhone(businessId: string, phone: string): Promise<number> {
    return this.repo().count({ where: { businessId, phone, status: "pending" } });
  }

  async createRequest(data: NewRequestInput, tx: Tx): Promise<AppointmentRequestRecord> {
    return toRecord(await this.create({ ...data, status: "pending" }, tx));
  }

  async decide(
    id: string,
    businessId: string,
    data: {
      status: RequestStatus;
      decidedBy: string;
      decisionNote: string | null;
      appointmentId?: string | null;
      customerId?: string | null;
    },
    tx: Tx,
  ): Promise<void> {
    await this.repo(tx).update({ id, businessId }, { ...data, decidedAt: new Date(), updatedAt: new Date() });
  }
}
