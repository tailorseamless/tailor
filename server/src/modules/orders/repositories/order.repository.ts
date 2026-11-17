import { Brackets, In, type Repository } from "typeorm";
import { AppDataSource } from "../../../infrastructure/database/dataSource";
import type { Paginated } from "../../../shared/pagination/paginate";
import { BaseRepository, likePattern } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import { NET_PAID_FOR_ORDER } from "../../payments/domain/paymentRules";
import { IN_PROGRESS_STATUSES } from "../domain/orderStatus";
import { lineTotal } from "../domain/orderMoney";
import {
  ORDER_LIMITS,
  type ListOrdersParams,
  type OrderItemInput,
  type OrderItemRecord,
  type OrderListRow,
  type OrderRecord,
  type OrderStatus,
  type OrderStatusEventRecord,
} from "../dto/order.dto";
import { Order } from "../entities/order.entity";
import { OrderItem } from "../entities/orderItem.entity";
import { OrderStatusEvent } from "../entities/orderStatusEvent.entity";

function toRecord(row: Order): OrderRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    customerId: row.customerId,
    branchId: row.branchId ?? null,
    orderNumber: row.orderNumber,
    status: row.status,
    dueDate: row.dueDate ?? null,
    totalAmount: Number(row.totalAmount),
    currency: row.currency,
    notes: row.notes ?? null,
    createdBy: row.createdBy ?? null,
    deliveredAt: row.deliveredAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toItemRecord(row: OrderItem): OrderItemRecord {
  const unitPrice = Number(row.unitPrice);
  return {
    id: row.id,
    garmentName: row.garmentName,
    description: row.description ?? null,
    quantity: row.quantity,
    unitPrice,
    lineTotal: lineTotal({ quantity: row.quantity, unitPrice }),
    fabricSource: row.fabricSource,
    measurementId: row.measurementId ?? null,
    designId: row.designId ?? null,
    position: row.position,
  };
}

function toEventRecord(row: OrderStatusEvent): OrderStatusEventRecord {
  return {
    id: row.id,
    fromStatus: row.fromStatus ?? null,
    toStatus: row.toStatus,
    note: row.note ?? null,
    changedBy: row.changedBy ?? null,
    createdAt: row.createdAt,
  };
}

/** Raw list row: pg hands `numeric` back as a string. */
type ListRaw = Omit<OrderListRow, "totalAmount" | "amountPaid"> & { totalAmount: string; amountPaid: string };

/** Orders, their items and their status history: one aggregate, one repository. */
export class OrderRepository extends BaseRepository<Order> {
  static Instance = new OrderRepository();

  private constructor() {
    super(Order);
  }

  private items(tx?: Tx): Repository<OrderItem> {
    return (tx ?? AppDataSource.manager).getRepository(OrderItem);
  }

  private events(tx?: Tx): Repository<OrderStatusEvent> {
    return (tx ?? AppDataSource.manager).getRepository(OrderStatusEvent);
  }

  /** Tenant scope in the query itself (Backend Guide §13.4). */
  async findInBusiness(id: string, businessId: string, tx?: Tx): Promise<OrderRecord | null> {
    const row = await this.repo(tx).findOne({ where: { id, businessId } });
    return row ? toRecord(row) : null;
  }

  /**
   * Reads the order under a row lock, so two people changing it at once queue
   * up and the second sees the first one's result (Backend Guide §8.4).
   */
  async findForUpdate(id: string, businessId: string, tx: Tx): Promise<OrderRecord | null> {
    const row = await this.repo(tx)
      .createQueryBuilder("o")
      .setLock("pessimistic_write")
      .where("o.id = :id AND o.businessId = :businessId", { id, businessId })
      .getOne();
    return row ? toRecord(row) : null;
  }

  /** Index: order_items(order_id, position). Bounded by ORDER_LIMITS.maxItems. */
  /** Items of a page of orders in ONE query (no N+1). Bounded: ids × ORDER_LIMITS.maxItems. */
  async findItemsForOrders(orderIds: string[]): Promise<Map<string, OrderItemRecord[]>> {
    const byOrder = new Map<string, OrderItemRecord[]>();
    if (orderIds.length === 0) return byOrder;
    const rows = await this.items().find({
      where: { orderId: In(orderIds) },
      order: { position: "ASC" },
      take: orderIds.length * ORDER_LIMITS.maxItems,
    });
    for (const row of rows) {
      const list = byOrder.get(row.orderId) ?? [];
      list.push(toItemRecord(row));
      byOrder.set(row.orderId, list);
    }
    return byOrder;
  }

  async findItems(orderId: string, tx?: Tx): Promise<OrderItemRecord[]> {
    const rows = await this.items(tx).find({
      where: { orderId },
      order: { position: "ASC" },
      take: ORDER_LIMITS.maxItems,
    });
    return rows.map(toItemRecord);
  }

  /** Oldest first. Index: order_status_history(order_id, created_at). */
  async findHistory(orderId: string, tx?: Tx): Promise<OrderStatusEventRecord[]> {
    const rows = await this.events(tx).find({
      where: { orderId },
      order: { createdAt: "ASC" },
      take: ORDER_LIMITS.historyShown,
    });
    return rows.map(toEventRecord);
  }

  /**
   * One query with the customer's name joined in (no N+1). The join does not
   * hide deleted customers: their orders still list (PRD BR-014).
   * Indexes: orders(business_id, created_at | status | due_date | customer_id).
   */
  async listForBusiness(params: ListOrdersParams): Promise<Paginated<OrderListRow>> {
    const qb = this.repo()
      .createQueryBuilder("o")
      // Joins keep soft-deleted customers, orders and staff: history must still show whose it was (PRD BR-014).
      .withDeleted()
      .innerJoin("customers", "c", "c.id = o.customer_id")
      .select("o.id", "id")
      .addSelect("o.businessId", "businessId")
      .addSelect("o.customerId", "customerId")
      .addSelect("o.branchId", "branchId")
      .addSelect("o.orderNumber", "orderNumber")
      .addSelect("o.status", "status")
      // As text: a raw `date` would arrive as a JS Date and shift by the server's time zone.
      .addSelect("to_char(o.dueDate, 'YYYY-MM-DD')", "dueDate")
      .addSelect("o.totalAmount", "totalAmount")
      .addSelect("o.currency", "currency")
      .addSelect("o.notes", "notes")
      .addSelect("o.createdBy", "createdBy")
      .addSelect("o.deliveredAt", "deliveredAt")
      .addSelect("o.createdAt", "createdAt")
      .addSelect("o.updatedAt", "updatedAt")
      .addSelect("c.full_name", "customerName")
      .addSelect("c.phone", "customerPhone")
      .addSelect(NET_PAID_FOR_ORDER, "amountPaid")
      .where("o.businessId = :businessId", { businessId: params.businessId })
      .andWhere("o.deletedAt IS NULL");

    if (params.status) qb.andWhere("o.status = :status", { status: params.status });
    if (params.customerId) qb.andWhere("o.customerId = :customerId", { customerId: params.customerId });
    if (params.branchId) qb.andWhere("o.branchId = :branchId", { branchId: params.branchId });
    if (params.from) qb.andWhere("o.createdAt >= :from", { from: params.from });
    if (params.to) qb.andWhere("o.createdAt < :to", { to: params.to });
    if (params.dueFrom) qb.andWhere("o.dueDate >= :dueFrom", { dueFrom: params.dueFrom });
    if (params.dueTo) qb.andWhere("o.dueDate <= :dueTo", { dueTo: params.dueTo });
    if (params.overdue) {
      qb.andWhere("o.dueDate < :today AND o.status IN (:...inProgress)", {
        today: params.today,
        inProgress: IN_PROGRESS_STATUSES,
      });
    }
    if (params.unfinished) qb.andWhere("o.status IN (:...unfinished)", { unfinished: IN_PROGRESS_STATUSES });
    if (params.unpaid) {
      // A fixed SQL fragment, not user input. Uses payments(order_id, created_at).
      qb.andWhere(`o.status <> 'cancelled' AND o.totalAmount > ${NET_PAID_FOR_ORDER}`);
    }
    if (params.search) {
      qb.andWhere(new Brackets((or) => or.where("o.orderNumber ILIKE :term").orWhere("c.full_name ILIKE :term")), {
        term: likePattern(params.search),
      });
    }

    if (params.sort === "due") qb.orderBy("o.dueDate", "ASC", "NULLS LAST").addOrderBy("o.createdAt", "DESC");
    else qb.orderBy("o.createdAt", "DESC");
    qb.addOrderBy("o.id", "DESC");

    const page = await this.paginateRaw<ListRaw, Order>(qb, params.page, params.limit);
    return {
      data: page.data.map((row) => ({
        ...row,
        totalAmount: Number(row.totalAmount),
        amountPaid: Number(row.amountPaid),
      })),
      meta: page.meta,
    };
  }

  /** The order, its items and the first history entry — all in the caller's transaction. */
  async createOrder(
    data: Pick<
      OrderRecord,
      | "businessId"
      | "customerId"
      | "branchId"
      | "orderNumber"
      | "status"
      | "dueDate"
      | "totalAmount"
      | "currency"
      | "notes"
    > & { createdBy: string },
    items: OrderItemInput[],
    tx: Tx,
  ): Promise<OrderRecord> {
    const created = await this.create(data, tx);
    await this.insertItems(created.id, items, tx);
    await this.addStatusEvent(
      { orderId: created.id, fromStatus: null, toStatus: data.status, changedBy: data.createdBy },
      tx,
    );
    return toRecord((await this.findById(created.id, tx)) ?? created);
  }

  async updateOrder(
    id: string,
    businessId: string,
    data: Partial<Pick<OrderRecord, "dueDate" | "notes" | "branchId" | "totalAmount" | "status" | "deliveredAt">>,
    tx: Tx,
  ): Promise<void> {
    await this.repo(tx).update({ id, businessId }, { ...data, updatedAt: new Date() });
  }

  async replaceItems(orderId: string, items: OrderItemInput[], tx: Tx): Promise<void> {
    await this.items(tx).softDelete({ orderId });
    await this.insertItems(orderId, items, tx);
  }

  async addStatusEvent(
    event: {
      orderId: string;
      fromStatus: OrderStatus | null;
      toStatus: OrderStatus;
      changedBy: string;
      note?: string | null;
    },
    tx: Tx,
  ): Promise<void> {
    await this.events(tx).insert({ ...event, note: event.note ?? null });
  }

  private async insertItems(orderId: string, items: OrderItemInput[], tx: Tx): Promise<void> {
    await this.items(tx).insert(
      items.map((item, position) => ({
        orderId,
        garmentName: item.garmentName,
        description: item.description ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        fabricSource: item.fabricSource,
        measurementId: item.measurementId ?? null,
        designId: item.designId ?? null,
        position,
      })),
    );
  }
}
