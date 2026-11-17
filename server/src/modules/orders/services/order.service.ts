import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { localDay } from "../../../shared/utils/timezone";
import { ActivityService } from "../../activity/services/activity.service";
import { BranchService } from "../../branches/services/branch.service";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { CustomerRepository } from "../../customers/repositories/customer.repository";
import { DesignRepository } from "../../designs/repositories/design.repository";
import type { IncomingFile } from "../../media/dto/media.dto";
import { ImageRepository } from "../../media/repositories/image.repository";
import { ImageService } from "../../media/services/image.service";
import { EmailOutboxService } from "../../notifications/services/emailOutbox.service";
import { CustomerMeasurementRepository } from "../../measurements/repositories/customerMeasurement.repository";
import { compareMoney } from "../../../shared/utils/money";
import { balanceDue } from "../../payments/domain/paymentRules";
import { PaymentRepository } from "../../payments/repositories/payment.repository";
import { formatOrderNumber, orderTotal } from "../domain/orderMoney";
import {
  canEditItems,
  canTransitionOrder,
  isClosed,
  isOverdue,
  statusLabel,
  tellsCustomer,
} from "../domain/orderStatus";
import type { OrderDetailDTO, OrderItemInput, OrderListItemDTO, OrderRecord } from "../dto/order.dto";
import { OrderRepository } from "../repositories/order.repository";
import type {
  ChangeOrderStatusInput,
  CreateOrderInput,
  ListOrdersQuery,
  UpdateOrderInput,
} from "../validators/order.schema";

export class OrderService {
  static Instance = new OrderService();

  private constructor(
    private readonly orders = OrderRepository.Instance,
    private readonly customers = CustomerRepository.Instance,
    private readonly measurements = CustomerMeasurementRepository.Instance,
    private readonly businesses = BusinessRepository.Instance,
    private readonly payments = PaymentRepository.Instance,
    private readonly branches = BranchService.Instance,
    private readonly designs = DesignRepository.Instance,
    private readonly imageRows = ImageRepository.Instance,
    private readonly images = ImageService.Instance,
    private readonly activity = ActivityService.Instance,
    private readonly emails = EmailOutboxService.Instance,
  ) {}

  /** `from` / `to`: taken between these instants (used by exports). */
  async list(actor: Actor, query: ListOrdersQuery & { from?: Date; to?: Date }): Promise<Paginated<OrderListItemDTO>> {
    const today = localDay(new Date(), actor.timeZone);
    const page = await this.orders.listForBusiness({ ...query, businessId: actor.businessId, today }); // tenant scope, always
    return {
      data: page.data.map((row) => ({
        ...row,
        isOverdue: isOverdue(row.status, row.dueDate, today),
        balance: balanceDue(row.status === "cancelled", row.totalAmount, row.amountPaid),
      })),
      meta: page.meta,
    };
  }

  /** Another business's order is a 404: existence must not leak. */
  async detail(actor: Actor, id: string): Promise<OrderDetailDTO> {
    const order = await this.orders.findInBusiness(id, actor.businessId);
    if (!order) throw AppError.notFound("Order not found");
    return this.describe(actor, order);
  }

  /**
   * PRD US-019: the order, its items, its number and its first history entry
   * are written in ONE transaction; the total is calculated here, never sent in.
   */
  async create(actor: Actor, input: CreateOrderInput): Promise<OrderDetailDTO> {
    return runInTransaction(async (tx) => {
      const customer = await this.customers.findInBusiness(input.customerId, actor.businessId, tx);
      if (!customer) {
        throw AppError.unprocessable("Choose a customer that exists", [{ field: "customerId", message: "Not found" }]);
      }
      await this.assertMeasurements(actor, input.customerId, input.items, tx);
      await this.assertDesigns(actor, input.items, tx);

      const business = await this.businesses.findBusiness(actor.businessId, tx);
      if (!business) throw AppError.notFound("Business not found");
      const sequence = await this.businesses.nextOrderSeq(actor.businessId, tx);
      const year = localDay(new Date(), business.timeZone).slice(0, 4);

      const order = await this.orders.createOrder(
        {
          businessId: actor.businessId,
          customerId: input.customerId,
          branchId: await this.branches.resolve(actor, input.branchId, tx),
          orderNumber: formatOrderNumber(sequence, year),
          status: "confirmed",
          dueDate: input.dueDate ?? null,
          totalAmount: orderTotal(input.items),
          currency: business.currency,
          notes: input.notes ?? null,
          createdBy: actor.id,
        },
        input.items,
        tx,
      );
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "order.created",
          entityType: "order",
          entityId: order.id,
          payload: { orderNumber: order.orderNumber, customerId: order.customerId, totalAmount: order.totalAmount },
        },
        tx,
      );
      return this.describe(actor, order, tx);
    });
  }

  /**
   * The due date and instructions can change until the order is closed; the
   * garments and prices only before production starts (PRD US-024).
   */
  async update(actor: Actor, id: string, input: UpdateOrderInput): Promise<OrderDetailDTO> {
    const { items, ...details } = input;
    return runInTransaction(async (tx) => {
      const order = await this.orders.findForUpdate(id, actor.businessId, tx);
      if (!order) throw AppError.notFound("Order not found");
      if (isClosed(order.status)) {
        throw AppError.conflict(`A ${statusLabel(order.status)} order cannot be changed`);
      }
      await this.branches.assertActive(actor, details.branchId, tx);
      if (items && !canEditItems(order.status)) {
        throw AppError.conflict("Garments and prices can only be changed before production starts");
      }

      if (items) {
        // The new total may not fall below what has already been received.
        const paid = await this.payments.netPaid(id, tx);
        if (compareMoney(orderTotal(items), paid) < 0) {
          throw AppError.conflict(
            `This order has already received ${paid.toFixed(2)}. Refund the difference before lowering the total.`,
          );
        }
        await this.assertMeasurements(actor, order.customerId, items, tx);
        await this.assertDesigns(actor, items, tx);
        await this.orders.replaceItems(id, items, tx);
      }
      await this.orders.updateOrder(
        id,
        actor.businessId,
        { ...details, ...(items ? { totalAmount: orderTotal(items) } : {}) },
        tx,
      );
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "order.updated",
          entityType: "order",
          entityId: id,
          payload: {
            fields: Object.keys(input),
            ...(items ? { totalBefore: order.totalAmount, totalAfter: orderTotal(items) } : {}),
          },
        },
        tx,
      );
      return this.describe(actor, (await this.orders.findInBusiness(id, actor.businessId, tx))!, tx);
    });
  }

  /**
   * PRD US-027: the move is validated, made under a row lock, and recorded
   * with who and when; the previous status stays in the history.
   */
  async changeStatus(actor: Actor, id: string, input: ChangeOrderStatusInput): Promise<OrderDetailDTO> {
    return runInTransaction(async (tx) => {
      const order = await this.orders.findForUpdate(id, actor.businessId, tx);
      if (!order) throw AppError.notFound("Order not found");
      if (!canTransitionOrder(order.status, input.status)) {
        throw AppError.conflict(
          order.status === input.status
            ? `This order is already ${statusLabel(order.status)}`
            : `A ${statusLabel(order.status)} order cannot move to ${statusLabel(input.status)}`,
        );
      }

      await this.orders.updateOrder(
        id,
        actor.businessId,
        { status: input.status, ...(input.status === "delivered" ? { deliveredAt: new Date() } : {}) },
        tx,
      );
      await this.orders.addStatusEvent(
        { orderId: id, fromStatus: order.status, toStatus: input.status, changedBy: actor.id, note: input.note },
        tx,
      );
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "order.status_changed",
          entityType: "order",
          entityId: id,
          payload: { from: order.status, to: input.status },
        },
        tx,
      );
      if (tellsCustomer(input.status)) await this.queueCustomerUpdate(actor, order, input.status, tx);
      return this.describe(actor, (await this.orders.findInBusiness(id, actor.businessId, tx))!, tx);
    });
  }

  /**
   * "Ready for a fitting / to collect / delivered" email to the customer, queued in the same
   * transaction as the status change. Only when they have an email and the business wants it.
   * Moving back and forth queues one per change: the key includes the moment it happened.
   */
  private async queueCustomerUpdate(
    actor: Actor,
    order: OrderRecord,
    status: OrderRecord["status"],
    tx: Tx,
  ): Promise<void> {
    const business = await this.businesses.findBusiness(actor.businessId, tx);
    if (!business?.emailOrderUpdates) return;
    // A removed customer is not emailed.
    const customer = await this.customers.findInBusiness(order.customerId, actor.businessId, tx);
    if (!customer?.email) return;
    await this.emails.queue(
      {
        businessId: actor.businessId,
        kind: "order.status",
        to: customer.email,
        toName: customer.fullName,
        payload: { orderId: order.id, status },
        dedupeKey: `order-status:${order.id}:${status}:${Date.now()}`,
      },
      tx,
    );
  }

  private async describe(actor: Actor, order: OrderRecord, tx?: Tx): Promise<OrderDetailDTO> {
    // One after another: inside a transaction they share a single connection.
    const customer = await this.customers.findInBusinessWithDeleted(order.customerId, actor.businessId, tx);
    const items = await this.orders.findItems(order.id, tx);
    const history = await this.orders.findHistory(order.id, tx);
    const images = await this.imageRows.listFor({ kind: "order", id: order.id }, tx);
    const amountPaid = await this.payments.netPaid(order.id, tx);
    return {
      ...order,
      isOverdue: isOverdue(order.status, order.dueDate, localDay(new Date(), actor.timeZone)),
      amountPaid,
      balance: balanceDue(order.status === "cancelled", order.totalAmount, amountPaid),
      customer: customer ? { id: customer.id, fullName: customer.fullName, phone: customer.phone } : null,
      items,
      images,
      history,
    };
  }

  /** Reference pictures (PRD US-021). Any order that is not closed can take them. */
  async addImages(actor: Actor, id: string, files: IncomingFile[]): Promise<OrderDetailDTO> {
    const order = await this.orders.findInBusiness(id, actor.businessId);
    if (!order) throw AppError.notFound("Order not found");
    await this.images.add(actor, { kind: "order", id }, files);
    return this.describe(actor, order);
  }

  async removeImage(actor: Actor, id: string, imageId: string): Promise<OrderDetailDTO> {
    const order = await this.orders.findInBusiness(id, actor.businessId);
    if (!order) throw AppError.notFound("Order not found");
    await this.images.remove(actor, { kind: "order", id }, imageId);
    return this.describe(actor, order);
  }

  /** A garment may only point at a design of this business. */
  private async assertDesigns(actor: Actor, items: OrderItemInput[], tx: Tx): Promise<void> {
    const ids = [...new Set(items.map((item) => item.designId).filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return;
    if ((await this.designs.countInBusiness(ids, actor.businessId, tx)) !== ids.length) {
      throw AppError.unprocessable("Choose designs from your catalogue", [
        { field: "items", message: "A design was not found" },
      ]);
    }
  }

  /** A garment may only point at a measurement record of the order's own customer. */
  private async assertMeasurements(actor: Actor, customerId: string, items: OrderItemInput[], tx: Tx): Promise<void> {
    const ids = [...new Set(items.map((item) => item.measurementId).filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return;
    const found = await this.measurements.countForCustomer(ids, customerId, actor.businessId, tx);
    if (found !== ids.length) {
      throw AppError.unprocessable("Choose measurements that belong to this customer", [
        { field: "items", message: "A measurement was not found for this customer" },
      ]);
    }
  }
}
