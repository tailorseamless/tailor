import { Brackets, type SelectQueryBuilder } from "typeorm";
import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository, returnedRows } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import {
  APPOINTMENT_LIMITS,
  type AppointmentDTO,
  type AppointmentRecord,
  type AppointmentSlot,
  type DueReminder,
  type ListAppointmentsParams,
} from "../dto/appointment.dto";
import { Appointment } from "../entities/appointment.entity";

type AppointmentInput = Pick<
  AppointmentRecord,
  | "customerId"
  | "orderId"
  | "branchId"
  | "assignedTo"
  | "type"
  | "startsAt"
  | "durationMinutes"
  | "notes"
  | "reminderMinutesBefore"
>;

function toRecord(row: Appointment): AppointmentRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    customerId: row.customerId,
    orderId: row.orderId ?? null,
    branchId: row.branchId ?? null,
    assignedTo: row.assignedTo ?? null,
    type: row.type,
    status: row.status,
    startsAt: row.startsAt,
    durationMinutes: row.durationMinutes,
    notes: row.notes ?? null,
    changeNote: row.changeNote ?? null,
    reminderMinutesBefore: row.reminderMinutesBefore ?? null,
    reminderSentAt: row.reminderSentAt ?? null,
    customerConfirmedAt: row.customerConfirmedAt ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class AppointmentRepository extends BaseRepository<Appointment> {
  static Instance = new AppointmentRepository();

  private constructor() {
    super(Appointment);
  }

  /**
   * One query with the customer, order number and assignee joined in (no N+1).
   * The joins do not hide deleted customers or staff: history still shows names.
   */
  private withNames(tx?: Tx): SelectQueryBuilder<Appointment> {
    return (
      this.repo(tx)
        .createQueryBuilder("a")
        // Joins keep soft-deleted customers, orders and staff: history must still show whose it was (PRD BR-014).
        .withDeleted()
        .innerJoin("customers", "c", "c.id = a.customer_id")
        .leftJoin("orders", "o", "o.id = a.order_id")
        .leftJoin("users", "u", "u.id = a.assigned_to")
        .select("a.id", "id")
        .addSelect("a.businessId", "businessId")
        .addSelect("a.customerId", "customerId")
        .addSelect("a.orderId", "orderId")
        .addSelect("a.branchId", "branchId")
        .addSelect("a.assignedTo", "assignedTo")
        .addSelect("a.type", "type")
        .addSelect("a.status", "status")
        .addSelect("a.startsAt", "startsAt")
        .addSelect("a.durationMinutes", "durationMinutes")
        .addSelect("a.notes", "notes")
        .addSelect("a.changeNote", "changeNote")
        .addSelect("a.reminderMinutesBefore", "reminderMinutesBefore")
        .addSelect("a.reminderSentAt", "reminderSentAt")
        .addSelect("a.customerConfirmedAt", "customerConfirmedAt")
        .addSelect("a.createdBy", "createdBy")
        .addSelect("a.createdAt", "createdAt")
        .addSelect("a.updatedAt", "updatedAt")
        .addSelect("c.full_name", "customerName")
        .addSelect("c.phone", "customerPhone")
        .addSelect("o.order_number", "orderNumber")
        .addSelect("u.full_name", "assignedName")
        .where("a.deletedAt IS NULL")
    );
  }

  /** Tenant scope in the query itself (Backend Guide §13.4). */
  async findInBusiness(id: string, businessId: string, tx?: Tx): Promise<AppointmentDTO | null> {
    const row = await this.withNames(tx)
      .andWhere("a.id = :id AND a.businessId = :businessId", { id, businessId })
      .getRawOne<AppointmentDTO>();
    return row ?? null;
  }

  /** Reads the appointment under a row lock, so two changes at once queue up (Backend Guide §8.4). */
  async findForUpdate(id: string, businessId: string, tx: Tx): Promise<AppointmentRecord | null> {
    const row = await this.repo(tx)
      .createQueryBuilder("a")
      .setLock("pessimistic_write")
      .where("a.id = :id AND a.businessId = :businessId", { id, businessId })
      .getOne();
    return row ? toRecord(row) : null;
  }

  /** Indexes: appointments(business_id, starts_at | customer_id | assigned_to+starts_at), appointments(order_id). */
  async listForBusiness(params: ListAppointmentsParams): Promise<Paginated<AppointmentDTO>> {
    const qb = this.withNames().andWhere("a.businessId = :businessId", { businessId: params.businessId });

    if (params.status) qb.andWhere("a.status = :status", { status: params.status });
    if (params.type) qb.andWhere("a.type = :type", { type: params.type });
    if (params.customerId) qb.andWhere("a.customerId = :customerId", { customerId: params.customerId });
    if (params.orderId) qb.andWhere("a.orderId = :orderId", { orderId: params.orderId });
    if (params.branchId) qb.andWhere("a.branchId = :branchId", { branchId: params.branchId });
    if (params.assignedTo) qb.andWhere("a.assignedTo = :assignedTo", { assignedTo: params.assignedTo });
    if (params.from) qb.andWhere("a.startsAt >= :from", { from: params.from });
    if (params.to) qb.andWhere("a.startsAt < :to", { to: params.to });
    if (params.day) {
      // Midnight to midnight in the given zone, compared as instants so the index is still usable.
      qb.andWhere(
        `a.startsAt >= (CAST(:day AS timestamp) AT TIME ZONE :zone)
         AND a.startsAt < ((CAST(:day AS timestamp) + interval '1 day') AT TIME ZONE :zone)`,
        { day: params.day, zone: params.timeZone },
      );
    }
    const direction = params.order === "desc" ? "DESC" : "ASC";
    qb.orderBy("a.startsAt", direction).addOrderBy("a.id", direction);

    return this.paginateRaw<AppointmentDTO, Appointment>(qb, params.page, params.limit);
  }

  /**
   * Booked appointments that overlap the slot and involve the same customer or
   * the same staff member. The `starts_at` window (no appointment is longer
   * than maxMinutes) keeps it on appointments(business_id, starts_at).
   */
  async findClashes(businessId: string, slot: AppointmentSlot, exceptId?: string, tx?: Tx): Promise<AppointmentDTO[]> {
    const end = new Date(slot.startsAt.getTime() + slot.durationMinutes * 60_000);
    const earliest = new Date(slot.startsAt.getTime() - APPOINTMENT_LIMITS.maxMinutes * 60_000);

    const qb = this.withNames(tx)
      .andWhere("a.businessId = :businessId AND a.status = 'scheduled'", { businessId })
      .andWhere("a.startsAt < :end AND a.startsAt > :earliest", { end, earliest })
      .andWhere("a.startsAt + a.durationMinutes * interval '1 minute' > :start", { start: slot.startsAt })
      .andWhere(
        new Brackets((or) => {
          or.where("a.customerId = :customerId", { customerId: slot.customerId });
          if (slot.assignedTo) or.orWhere("a.assignedTo = :assignedTo", { assignedTo: slot.assignedTo });
        }),
      );
    if (exceptId) qb.andWhere("a.id <> :exceptId", { exceptId });
    return qb.orderBy("a.startsAt", "ASC").limit(APPOINTMENT_LIMITS.clashesShown).getRawMany<AppointmentDTO>();
  }

  /**
   * Claims the reminders that are due — and stamps them sent in the same
   * statement, so two runs can never send one twice. SKIP LOCKED lets an
   * appointment someone is editing wait for the next run.
   * Index: IDX_appointments_reminder_due.
   */
  async claimDueReminders(limit: number, tx: Tx): Promise<DueReminder[]> {
    const result: unknown = await tx.query(
      `WITH due AS (
         UPDATE appointments
            SET reminder_sent_at = now()
          WHERE id IN (
                SELECT id FROM appointments
                 WHERE status = 'scheduled'
                   AND reminder_minutes_before IS NOT NULL
                   AND reminder_sent_at IS NULL
                   AND deleted_at IS NULL
                   AND starts_at > now()
                   AND starts_at - reminder_minutes_before * interval '1 minute' <= now()
                 ORDER BY starts_at
                 LIMIT $1
                   FOR UPDATE SKIP LOCKED)
         RETURNING id, business_id, customer_id, assigned_to, created_by, type, starts_at)
       SELECT due.id,
              due.business_id AS "businessId",
              COALESCE(due.assigned_to, due.created_by) AS "userId",
              due.type,
              due.starts_at AS "startsAt",
              c.full_name AS "customerName",
              c.email AS "customerEmail",
              b.email_customer_reminders AS "emailCustomer",
              b.time_zone AS "timeZone"
         FROM due
         JOIN customers c ON c.id = due.customer_id
         JOIN businesses b ON b.id = due.business_id`,
      [limit],
    );
    return returnedRows<DueReminder>(result);
  }

  /** Clears the assignee on appointments still booked with someone who is leaving the team. */
  async unassignScheduled(businessId: string, userId: string, tx: Tx): Promise<number> {
    const result = await this.repo(tx).update(
      { businessId, assignedTo: userId, status: "scheduled" },
      { assignedTo: null, updatedAt: new Date() },
    );
    return result.affected ?? 0;
  }

  async createAppointment(data: AppointmentInput & { businessId: string; createdBy: string }, tx: Tx): Promise<string> {
    return (await this.create({ ...data, status: "scheduled" }, tx)).id;
  }

  async updateAppointment(
    id: string,
    businessId: string,
    data: Partial<
      AppointmentInput & Pick<AppointmentRecord, "status" | "changeNote" | "reminderSentAt" | "customerConfirmedAt">
    >,
    tx: Tx,
  ): Promise<void> {
    await this.repo(tx).update({ id, businessId }, { ...data, updatedAt: new Date() });
  }
}
