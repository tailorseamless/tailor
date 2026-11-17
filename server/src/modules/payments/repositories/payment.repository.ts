import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import { NET_PAID_FOR_ORDER } from "../domain/paymentRules";
import type { ListPaymentsParams, PaymentListItemDTO, PaymentRecord } from "../dto/payment.dto";
import { Payment } from "../entities/payment.entity";

const IS_VOIDED = `EXISTS (SELECT 1 FROM payments v WHERE v.reverses_payment_id = p.id)`;

function toRecord(row: Payment, voided: boolean): PaymentRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    orderId: row.orderId,
    customerId: row.customerId,
    kind: row.kind,
    amount: Number(row.amount),
    method: row.method,
    reference: row.reference ?? null,
    paidAt: row.paidAt,
    note: row.note ?? null,
    receiptNumber: row.receiptNumber ?? null,
    reversesPaymentId: row.reversesPaymentId ?? null,
    recordedBy: row.recordedBy ?? null,
    createdAt: row.createdAt,
    voided,
  };
}

/** Raw list row: pg hands `numeric` back as a string. */
type ListRaw = Omit<PaymentListItemDTO, "amount"> & { amount: string };

export class PaymentRepository extends BaseRepository<Payment> {
  static Instance = new PaymentRepository();

  private constructor() {
    super(Payment);
  }

  /**
   * Net amount received for an order: payments − refunds, without voided
   * entries. Index: payments(order_id, created_at).
   */
  async netPaid(orderId: string, tx?: Tx): Promise<number> {
    const rows: { net: string }[] = await this.repo(tx).query(
      `SELECT ${NET_PAID_FOR_ORDER} AS net FROM orders o WHERE o.id = $1`,
      [orderId],
    );
    return Number(rows[0]?.net ?? 0);
  }

  /** Tenant scope in the query itself (Backend Guide §13.4). */
  async findInBusiness(id: string, businessId: string, tx?: Tx): Promise<PaymentRecord | null> {
    const row = await this.repo(tx).findOne({ where: { id, businessId } });
    if (!row) return null;
    const voided = await this.repo(tx).exists({ where: { reversesPaymentId: id } });
    return toRecord(row, voided);
  }

  /**
   * Newest first, with the order number and customer name joined in (no N+1).
   * Indexes: payments(business_id, paid_at | customer_id), payments(order_id, created_at).
   */
  async listForBusiness(params: ListPaymentsParams): Promise<Paginated<PaymentListItemDTO>> {
    const qb = this.repo()
      .createQueryBuilder("p")
      // Joins keep soft-deleted customers, orders and staff: history must still show whose it was (PRD BR-014).
      .withDeleted()
      .innerJoin("orders", "o", "o.id = p.order_id")
      .innerJoin("customers", "c", "c.id = p.customer_id")
      .select("p.id", "id")
      .addSelect("p.businessId", "businessId")
      .addSelect("p.orderId", "orderId")
      .addSelect("p.customerId", "customerId")
      .addSelect("p.kind", "kind")
      .addSelect("p.amount", "amount")
      .addSelect("p.method", "method")
      .addSelect("p.reference", "reference")
      .addSelect("p.paidAt", "paidAt")
      .addSelect("p.note", "note")
      .addSelect("p.receiptNumber", "receiptNumber")
      .addSelect("p.reversesPaymentId", "reversesPaymentId")
      .addSelect("p.recordedBy", "recordedBy")
      .addSelect("p.createdAt", "createdAt")
      .addSelect(IS_VOIDED, "voided")
      .addSelect("o.order_number", "orderNumber")
      .addSelect("c.full_name", "customerName")
      .where("p.businessId = :businessId", { businessId: params.businessId });

    if (params.orderId) qb.andWhere("p.orderId = :orderId", { orderId: params.orderId });
    if (params.customerId) qb.andWhere("p.customerId = :customerId", { customerId: params.customerId });
    if (params.branchId) qb.andWhere("o.branch_id = :branchId", { branchId: params.branchId });
    if (params.kind) qb.andWhere("p.kind = :kind", { kind: params.kind });
    if (params.method) qb.andWhere("p.method = :method", { method: params.method });
    if (params.from) qb.andWhere("p.paidAt >= :from", { from: params.from });
    if (params.to) qb.andWhere("p.paidAt < :to", { to: params.to });
    qb.orderBy("p.paidAt", "DESC").addOrderBy("p.createdAt", "DESC").addOrderBy("p.id", "DESC");

    const page = await this.paginateRaw<ListRaw, Payment>(qb, params.page, params.limit);
    return { data: page.data.map((row) => ({ ...row, amount: Number(row.amount) })), meta: page.meta };
  }

  /** Appends one entry. There is deliberately no update or delete. */
  async append(data: Omit<PaymentRecord, "id" | "createdAt" | "voided">, tx: Tx): Promise<PaymentRecord> {
    return toRecord(await this.create(data, tx), false);
  }
}
