import { BaseRepository, returnedRows } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { BusinessRecord } from "../dto/business.dto";
import { Business } from "../entities/business.entity";

type BusinessInput = Partial<Omit<BusinessRecord, "id" | "createdAt" | "updatedAt">>;

function toRecord(row: Business): BusinessRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    currency: row.currency,
    timeZone: row.timeZone,
    deletionScheduledFor: row.deletionScheduledFor ?? null,
    measurementUnit: row.measurementUnit,
    status: row.status,
    emailCustomerReminders: row.emailCustomerReminders ?? true,
    emailReceipts: row.emailReceipts ?? true,
    emailOrderUpdates: row.emailOrderUpdates ?? true,
    slug: row.slug ?? null,
    bookingEnabled: row.bookingEnabled ?? false,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class BusinessRepository extends BaseRepository<Business> {
  static Instance = new BusinessRepository();

  private constructor() {
    super(Business);
  }

  async findBusiness(id: string, tx?: Tx): Promise<BusinessRecord | null> {
    const row = await this.findById(id, tx);
    return row ? toRecord(row) : null;
  }

  /** Index: UQ_businesses_slug. */
  async findBySlug(slug: string, tx?: Tx): Promise<BusinessRecord | null> {
    const row = await this.repo(tx).findOne({ where: { slug } });
    return row ? toRecord(row) : null;
  }

  async createBusiness(data: BusinessInput, tx?: Tx): Promise<BusinessRecord> {
    const created = await this.create(data, tx);
    // Re-read so database defaults (currency, time zone, unit) are on the record.
    return toRecord((await this.findById(created.id, tx)) ?? created);
  }

  /**
   * The next order sequence for this business, in ONE atomic statement that
   * row-locks the business until the caller's transaction ends — two orders
   * taken at once can never share a number (Backend Guide §8.4).
   */
  nextOrderSeq(id: string, tx: Tx): Promise<number> {
    return this.nextSeq(id, "order_seq", tx);
  }

  /** As `nextOrderSeq`, for receipt numbers. */
  nextReceiptSeq(id: string, tx: Tx): Promise<number> {
    return this.nextSeq(id, "receipt_seq", tx);
  }

  /** `counter` is one of two fixed column names — never user input. */
  private async nextSeq(id: string, counter: "order_seq" | "receipt_seq", tx: Tx): Promise<number> {
    const result: unknown = await tx.query(
      `UPDATE businesses SET ${counter} = ${counter} + 1 WHERE id = $1 AND deleted_at IS NULL RETURNING ${counter} AS seq`,
      [id],
    );
    const row = returnedRows<{ seq: number }>(result)[0];
    if (!row) throw new Error(`business ${id} not found while taking the next ${counter}`);
    return Number(row.seq);
  }

  async setDeletionSchedule(id: string, at: Date | null, tx?: Tx): Promise<void> {
    await this.repo(tx).update(id, { deletionScheduledFor: at, updatedAt: new Date() });
  }

  async updateBusiness(id: string, data: BusinessInput, tx?: Tx): Promise<BusinessRecord | null> {
    const row = await this.update(id, data, tx);
    return row ? toRecord(row) : null;
  }
}
