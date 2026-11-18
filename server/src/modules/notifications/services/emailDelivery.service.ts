import { EMAIL } from "../../../config/constants";
import { renderReceiptPdf } from "../../../infrastructure/documents/receiptPdf";
import { logger } from "../../../infrastructure/logger/logger";
import { MailerService, type EmailMessage } from "../../../shared/services/mailer.service";
import { AppointmentRepository } from "../../appointments/repositories/appointment.repository";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { OrderRepository } from "../../orders/repositories/order.repository";
import { balanceDue } from "../../payments/domain/paymentRules";
import { PaymentRepository } from "../../payments/repositories/payment.repository";
import { PaymentService } from "../../payments/services/payment.service";
import { canReceiveEmail, isTooOld, nextRetry } from "../domain/emailRules";
import {
  appointmentReminderEmail,
  invitationEmail,
  notificationEmail,
  orderUpdateEmail,
  receiptEmail,
  requestDecidedEmail,
  requestReceivedEmail,
} from "../domain/emailTemplates";
import type { EmailPayloads, OutboxRow } from "../dto/email.dto";
import { EmailOutboxRepository } from "../repositories/emailOutbox.repository";
import { NotificationRepository } from "../repositories/notification.repository";

/** Why a queued email will not go. Not an error: it is recorded and skipped. */
class Skip {
  constructor(readonly reason: string) {}
}

/**
 * The outbox sender, run by the `deliverEmails` job. Each email is sent and
 * recorded on its own, so one bad address never blocks the rest. While email
 * is switched off the rows wait untouched — nothing is lost.
 */
export class EmailDeliveryService {
  static Instance = new EmailDeliveryService();

  private constructor(
    private readonly outbox = EmailOutboxRepository.Instance,
    private readonly mailer = MailerService.Instance,
    private readonly appointments = AppointmentRepository.Instance,
    private readonly businesses = BusinessRepository.Instance,
    private readonly payments = PaymentService.Instance,
    private readonly notificationRows = NotificationRepository.Instance,
    private readonly orders = OrderRepository.Instance,
    private readonly paymentRows = PaymentRepository.Instance,
  ) {}

  async deliverPending(limit: number = EMAIL.perTick): Promise<{ sent: number; failed: number; cancelled: number }> {
    const result = { sent: 0, failed: 0, cancelled: 0 };
    if (!this.mailer.enabled) return result;

    for (const row of await this.outbox.claimDue(limit)) {
      const now = new Date();
      try {
        if (!canReceiveEmail(row.toAddress)) throw new Skip("Address cannot receive email");
        if (isTooOld(row.kind, new Date(row.createdAt), now)) throw new Skip("Too old to send");

        const message = await this.build(row);
        const { messageId } = await this.mailer.send(message);
        await this.outbox.markSent(row.id, messageId);
        result.sent += 1;
      } catch (err) {
        if (err instanceof Skip) {
          await this.outbox.markCancelled(row.id, err.reason);
          result.cancelled += 1;
          continue;
        }
        const error = err instanceof Error ? err.message : String(err);
        const retryAt = nextRetry(row.attempts, now);
        await this.outbox.markAttemptFailed(row.id, error, retryAt);
        logger.warn({ emailId: row.id, kind: row.kind, attempts: row.attempts + 1, err }, "email not sent");
        if (!retryAt) result.failed += 1;
      }
    }
    return result;
  }

  /** Builds the message from its payload, reading anything that may have changed since it was queued. */
  private async build(row: OutboxRow): Promise<EmailMessage> {
    const to = { to: row.toAddress, toName: row.toName };
    switch (row.kind) {
      case "team.invitation":
        return { ...to, ...invitationEmail(row.payload as unknown as EmailPayloads["team.invitation"]) };

      case "appointment.request_received":
        return {
          ...to,
          ...(await this.withReplyTo(row.businessId)),
          ...requestReceivedEmail(row.payload as unknown as EmailPayloads["appointment.request_received"]),
        };

      case "appointment.request_decided":
        return {
          ...to,
          ...(await this.withReplyTo(row.businessId)),
          ...requestDecidedEmail(row.payload as unknown as EmailPayloads["appointment.request_decided"]),
        };

      case "appointment.reminder": {
        const { appointmentId } = row.payload as unknown as EmailPayloads["appointment.reminder"];
        const [appointment, business] = await Promise.all([
          this.appointments.findInBusiness(appointmentId, row.businessId),
          this.businesses.findBusiness(row.businessId),
        ]);
        if (!appointment || !business) throw new Skip("Appointment no longer exists");
        if (appointment.status !== "scheduled") throw new Skip(`Appointment is ${appointment.status}`);
        if (new Date(appointment.startsAt).getTime() <= Date.now()) throw new Skip("Appointment has started");
        return {
          ...to,
          replyTo: business.email,
          ...appointmentReminderEmail({
            businessName: business.name,
            businessAddress: business.address,
            businessPhone: business.phone,
            customerName: appointment.customerName,
            type: appointment.type,
            startsAt: new Date(appointment.startsAt),
            durationMinutes: appointment.durationMinutes,
            timeZone: business.timeZone,
          }),
        };
      }

      case "notification": {
        const { notificationId } = row.payload as unknown as EmailPayloads["notification"];
        const notification = await this.notificationRows.findById(notificationId);
        if (!notification) throw new Skip("Notification no longer exists");
        if (notification.readAt) throw new Skip("Already read in the app");
        const business = await this.businesses.findBusiness(row.businessId);
        return {
          ...to,
          ...notificationEmail({
            businessName: business?.name ?? "Tailor Seamless",
            title: notification.title,
            body: notification.body,
            linkPath: notification.linkPath,
          }),
        };
      }

      case "order.status": {
        const { orderId, status } = row.payload as unknown as EmailPayloads["order.status"];
        const [order, business] = await Promise.all([
          this.orders.findInBusiness(orderId, row.businessId),
          this.businesses.findBusiness(row.businessId),
        ]);
        if (!order || !business) throw new Skip("Order no longer exists");
        // Moved on before we sent it (e.g. marked ready by mistake): say nothing out of date.
        if (order.status !== status) throw new Skip(`Order is now ${order.status}`);
        if (!business.emailOrderUpdates) throw new Skip("Order update emails were turned off");
        if (status !== "fitting" && status !== "ready" && status !== "delivered")
          throw new Skip("Not a customer update");
        const items = await this.orders.findItems(order.id);
        const paid = await this.paymentRows.netPaid(order.id);
        return {
          ...to,
          replyTo: business.email,
          ...orderUpdateEmail({
            businessName: business.name,
            businessPhone: business.phone,
            businessAddress: business.address,
            customerName: row.toName ?? "there",
            orderNumber: order.orderNumber,
            garments:
              items.map((i) => (i.quantity > 1 ? `${i.quantity} ${i.garmentName}` : i.garmentName)).join(", ") ||
              "order",
            status,
            balance: balanceDue(false, order.totalAmount, paid),
            currency: order.currency,
          }),
        };
      }

      case "receipt": {
        const { paymentId } = row.payload as unknown as EmailPayloads["receipt"];
        const receipt = await this.payments.receiptFor(row.businessId, paymentId).catch(() => null);
        if (!receipt) throw new Skip("Receipt no longer exists");
        if (receipt.voided) throw new Skip("Payment was voided");
        return {
          ...to,
          replyTo: receipt.business.email,
          ...receiptEmail(receipt),
          attachments: [
            {
              filename: `Receipt-${receipt.receiptNumber}.pdf`,
              contentType: "application/pdf",
              content: await renderReceiptPdf(receipt),
            },
          ],
        };
      }
    }
  }

  private async withReplyTo(businessId: string): Promise<{ replyTo: string | null }> {
    const business = await this.businesses.findBusiness(businessId);
    return { replyTo: business?.email ?? null };
  }
}
