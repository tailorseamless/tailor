import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { addMoney, compareMoney, subtractMoney } from "../../../shared/utils/money";
import { localDay } from "../../../shared/utils/timezone";
import { renderReceiptPdf } from "../../../infrastructure/documents/receiptPdf";
import { MailerService } from "../../../shared/services/mailer.service";
import { ActivityService } from "../../activity/services/activity.service";
import { EmailOutboxService } from "../../notifications/services/emailOutbox.service";
import type { AuditAction } from "../../activity/dto/activity.dto";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { CustomerRepository } from "../../customers/repositories/customer.repository";
import type { OrderRecord } from "../../orders/dto/order.dto";
import { OrderRepository } from "../../orders/repositories/order.repository";
import { balanceDue, exceedsBalance, exceedsPaid, formatReceiptNumber } from "../domain/paymentRules";
import type {
  PaymentListItemDTO,
  PaymentRecord,
  PaymentResultDTO,
  PaymentSummary,
  ReceiptDTO,
} from "../dto/payment.dto";
import { PaymentRepository } from "../repositories/payment.repository";
import type {
  ListOrderPaymentsQuery,
  ListPaymentsQuery,
  RecordPaymentInput,
  RecordRefundInput,
  VoidPaymentInput,
} from "../validators/payment.schema";

function summarise(order: OrderRecord, amountPaid: number): PaymentSummary {
  return {
    totalAmount: order.totalAmount,
    amountPaid,
    balance: balanceDue(order.status === "cancelled", order.totalAmount, amountPaid),
    currency: order.currency,
  };
}

/**
 * Payments are financial transactions (PRD §3.5): individual, append-only
 * entries from which every balance is derived. Each change locks the order
 * row first, so two entries recorded at once are checked one after the other.
 */
export class PaymentService {
  static Instance = new PaymentService();

  private constructor(
    private readonly payments = PaymentRepository.Instance,
    private readonly orders = OrderRepository.Instance,
    private readonly businesses = BusinessRepository.Instance,
    private readonly customers = CustomerRepository.Instance,
    private readonly activity = ActivityService.Instance,
    private readonly emails = EmailOutboxService.Instance,
    private readonly mailer = MailerService.Instance,
  ) {}

  /** Every entry of the business, newest first (PRD US-037). */
  list(actor: Actor, query: ListPaymentsQuery): Promise<Paginated<PaymentListItemDTO>> {
    return this.payments.listForBusiness({ ...query, businessId: actor.businessId }); // tenant scope, always
  }

  /** One order's payment history. */
  async listForOrder(
    actor: Actor,
    orderId: string,
    query: ListOrderPaymentsQuery,
  ): Promise<Paginated<PaymentListItemDTO>> {
    if (!(await this.orders.findInBusiness(orderId, actor.businessId))) throw AppError.notFound("Order not found");
    return this.payments.listForBusiness({ ...query, orderId, businessId: actor.businessId });
  }

  /** A deposit, an instalment or the final payment (PRD US-033, US-034). */
  async record(actor: Actor, orderId: string, input: RecordPaymentInput): Promise<PaymentResultDTO> {
    return runInTransaction(async (tx) => {
      const order = await this.lockOrder(actor, orderId, tx);
      if (order.status === "cancelled") throw AppError.conflict("A cancelled order cannot take payments");

      const paid = await this.payments.netPaid(orderId, tx);
      const balance = balanceDue(false, order.totalAmount, paid);
      if (exceedsBalance(input.amount, balance)) {
        throw AppError.unprocessable(
          balance > 0 ? "The amount is more than the outstanding balance" : "This order is already fully paid",
          [{ field: "amount", message: `The outstanding balance is ${balance.toFixed(2)}` }],
        );
      }

      const payment = await this.append(actor, order, "payment", input, tx);
      return { payment, summary: summarise(order, addMoney(paid, input.amount)) };
    });
  }

  /** Money given back to the customer. Never more than was received. */
  async refund(actor: Actor, orderId: string, input: RecordRefundInput): Promise<PaymentResultDTO> {
    return runInTransaction(async (tx) => {
      const order = await this.lockOrder(actor, orderId, tx);
      const paid = await this.payments.netPaid(orderId, tx);
      if (exceedsPaid(input.amount, paid)) {
        throw AppError.unprocessable("The refund is more than this order has received", [
          { field: "amount", message: `The amount received is ${paid.toFixed(2)}` },
        ]);
      }

      const payment = await this.append(actor, order, "refund", input, tx);
      return { payment, summary: summarise(order, subtractMoney(paid, input.amount)) };
    });
  }

  /**
   * Corrects an entry recorded by mistake — by adding a `void` entry, never by
   * editing or deleting (PRD §3.5). The original stays, marked as voided.
   */
  async void(actor: Actor, paymentId: string, input: VoidPaymentInput): Promise<PaymentResultDTO> {
    return runInTransaction(async (tx) => {
      const found = await this.payments.findInBusiness(paymentId, actor.businessId, tx);
      if (!found) throw AppError.notFound("Payment not found");
      const order = await this.lockOrder(actor, found.orderId, tx);

      // Re-read under the lock: someone may have voided it a moment ago.
      const target = (await this.payments.findInBusiness(paymentId, actor.businessId, tx))!;
      if (target.kind === "void") throw AppError.conflict("A void cannot itself be voided");
      if (target.voided) throw AppError.conflict("This entry has already been voided");

      const paid = await this.payments.netPaid(order.id, tx);
      const after = target.kind === "payment" ? subtractMoney(paid, target.amount) : addMoney(paid, target.amount);
      if (after < 0) {
        throw AppError.conflict("Voiding this payment would leave more refunded than received. Void the refund first.");
      }
      if (target.kind === "refund" && compareMoney(after, order.totalAmount) > 0) {
        throw AppError.conflict("Voiding this refund would leave the order paid more than its total");
      }

      const payment = await this.payments.append(
        {
          businessId: actor.businessId,
          orderId: order.id,
          customerId: order.customerId,
          kind: "void",
          amount: target.amount,
          method: target.method,
          reference: null,
          paidAt: new Date(),
          note: input.reason,
          receiptNumber: null,
          reversesPaymentId: target.id,
          recordedBy: actor.id,
        },
        tx,
      );
      await this.audit(actor, "payment.voided", payment, { voided: target.id, voidedKind: target.kind }, tx);
      return { payment, summary: summarise(order, after) };
    });
  }

  /** Everything a printed or shared receipt needs (PRD US-036). */
  receipt(actor: Actor, paymentId: string): Promise<ReceiptDTO> {
    return this.receiptFor(actor.businessId, paymentId);
  }

  /** The receipt as a printable PDF (PRD US-036). */
  async receiptPdf(actor: Actor, paymentId: string): Promise<{ filename: string; content: Buffer }> {
    const receipt = await this.receiptFor(actor.businessId, paymentId);
    return { filename: `Receipt-${receipt.receiptNumber}.pdf`, content: await renderReceiptPdf(receipt) };
  }

  /** (Re)sends the receipt by email — to the customer, or to the address given. */
  async emailReceipt(
    actor: Actor,
    paymentId: string,
    to: string | undefined,
  ): Promise<{ queued: boolean; to: string; emailEnabled: boolean }> {
    const receipt = await this.receiptFor(actor.businessId, paymentId);
    if (receipt.voided) throw AppError.conflict("A voided entry has no receipt to send");
    const address = to ?? receipt.customer?.email ?? null;
    if (!address) {
      throw AppError.unprocessable("This customer has no email address. Enter one to send the receipt to.", [
        { field: "to", message: "Required" },
      ]);
    }
    const queued = await this.emails.queue({
      businessId: actor.businessId,
      kind: "receipt",
      to: address,
      toName: receipt.customer?.fullName ?? null,
      payload: { paymentId },
    });
    return { queued, to: address, emailEnabled: this.mailer.enabled };
  }

  /** The receipt of one payment or refund, for any reader that already knows the business. */
  async receiptFor(businessId: string, paymentId: string): Promise<ReceiptDTO> {
    const actor = { businessId };
    const payment = await this.payments.findInBusiness(paymentId, actor.businessId);
    if (!payment || payment.kind === "void" || !payment.receiptNumber) throw AppError.notFound("Receipt not found");

    const [order, business, customer, paid] = await Promise.all([
      this.orders.findInBusiness(payment.orderId, actor.businessId),
      this.businesses.findBusiness(actor.businessId),
      this.customers.findInBusinessWithDeleted(payment.customerId, actor.businessId),
      this.payments.netPaid(payment.orderId),
    ]);
    if (!order || !business) throw AppError.notFound("Receipt not found");

    const summary = summarise(order, paid);
    return {
      receiptNumber: payment.receiptNumber,
      kind: payment.kind,
      voided: payment.voided,
      amount: payment.amount,
      currency: order.currency,
      method: payment.method,
      reference: payment.reference,
      paidAt: payment.paidAt,
      note: payment.note,
      business: {
        name: business.name,
        phone: business.phone,
        email: business.email,
        address: business.address,
        timeZone: business.timeZone,
      },
      customer: customer ? { fullName: customer.fullName, phone: customer.phone, email: customer.email } : null,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: summary.totalAmount,
        amountPaid: summary.amountPaid,
        balance: summary.balance,
      },
    };
  }

  /** Another business's order is a 404: existence must not leak. */
  private async lockOrder(actor: Actor, orderId: string, tx: Tx): Promise<OrderRecord> {
    const order = await this.orders.findForUpdate(orderId, actor.businessId, tx);
    if (!order) throw AppError.notFound("Order not found");
    return order;
  }

  /** Numbers the receipt, appends the entry and writes the audit row — all in the caller's transaction. */
  private async append(
    actor: Actor,
    order: OrderRecord,
    kind: "payment" | "refund",
    input: RecordPaymentInput | RecordRefundInput,
    tx: Tx,
  ): Promise<PaymentRecord> {
    const business = await this.businesses.findBusiness(actor.businessId, tx);
    const sequence = await this.businesses.nextReceiptSeq(actor.businessId, tx);
    const year = localDay(new Date(), business?.timeZone ?? actor.timeZone).slice(0, 4);

    const payment = await this.payments.append(
      {
        businessId: actor.businessId,
        orderId: order.id,
        customerId: order.customerId,
        kind,
        amount: input.amount,
        method: input.method,
        reference: input.reference ?? null,
        paidAt: input.paidAt ?? new Date(),
        note: input.note ?? null,
        receiptNumber: formatReceiptNumber(sequence, year),
        reversesPaymentId: null,
        recordedBy: actor.id,
      },
      tx,
    );
    await this.audit(actor, kind === "payment" ? "payment.recorded" : "payment.refunded", payment, {}, tx);

    // The receipt goes by email when the customer has an address and the business wants it — queued in this transaction.
    const customer = await this.customers.findInBusinessWithDeleted(order.customerId, actor.businessId, tx);
    if (customer?.email && business?.emailReceipts) {
      await this.emails.queue(
        {
          businessId: actor.businessId,
          kind: "receipt",
          to: customer.email,
          toName: customer.fullName,
          payload: { paymentId: payment.id },
          dedupeKey: `receipt:${payment.id}`,
        },
        tx,
      );
    }
    return payment;
  }

  private audit(actor: Actor, action: AuditAction, payment: PaymentRecord, extra: Record<string, unknown>, tx: Tx) {
    return this.activity.audit(
      {
        businessId: actor.businessId,
        actorId: actor.id,
        action,
        entityType: "payment",
        entityId: payment.id,
        payload: { orderId: payment.orderId, amount: payment.amount, method: payment.method, ...extra },
      },
      tx,
    );
  }
}
