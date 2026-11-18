import { env } from "../../../config/env";
import { renderReceiptPdf } from "../../../infrastructure/documents/receiptPdf";
import { AppError } from "../../../shared/errors/AppError";
import { runInTransaction } from "../../../shared/repositories/transaction";
import { sha256 } from "../../../shared/utils/hash";
import { APPOINTMENT_TYPE_LABELS } from "../../../shared/utils/format";
import { localDay } from "../../../shared/utils/timezone";
import { ActivityService } from "../../activity/services/activity.service";
import { APPOINTMENT_TYPES } from "../../appointments/dto/appointment.dto";
import { AppointmentRepository } from "../../appointments/repositories/appointment.repository";
import type { BusinessRecord } from "../../businesses/dto/business.dto";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import type { CustomerRecord } from "../../customers/dto/customer.dto";
import { CustomerRepository } from "../../customers/repositories/customer.repository";
import { DesignService } from "../../designs/services/design.service";
import { CustomerMeasurementRepository } from "../../measurements/repositories/customerMeasurement.repository";
import { NotificationService } from "../../notifications/services/notification.service";
import { estimatedMaxTotal, estimatedMinTotal, orderDiscount } from "../../orders/domain/orderMoney";
import { OrderRepository } from "../../orders/repositories/order.repository";
import { balanceDue } from "../../payments/domain/paymentRules";
import { PaymentRepository } from "../../payments/repositories/payment.repository";
import { PaymentService } from "../../payments/services/payment.service";
import type { AppointmentRequestRecord } from "../../requests/dto/request.dto";
import { RequestRepository } from "../../requests/repositories/request.repository";
import { RequestService } from "../../requests/services/request.service";
import { PORTAL_LIMITS, type BookingPageDTO, type PortalDTO, type PublicBusinessDTO } from "../dto/portal.dto";
import type { BookingRequestInput, PortalRequestInput } from "../validators/portal.schema";

/** One message for every bad link — never say whether a link once existed. */
const NOT_FOUND = "This link is not valid any more. Ask the business for a new one.";

/**
 * The public side: the customer portal (secret link) and the booking page
 * (public address). Every read is scoped to the one business — and, in the
 * portal, the one customer — that the link resolves to.
 */
export class PortalService {
  static Instance = new PortalService();

  private constructor(
    private readonly customers = CustomerRepository.Instance,
    private readonly businesses = BusinessRepository.Instance,
    private readonly orders = OrderRepository.Instance,
    private readonly appointments = AppointmentRepository.Instance,
    private readonly payments = PaymentRepository.Instance,
    private readonly paymentService = PaymentService.Instance,
    private readonly requests = RequestRepository.Instance,
    private readonly requestService = RequestService.Instance,
    private readonly designs = DesignService.Instance,
    private readonly notifications = NotificationService.Instance,
    private readonly activity = ActivityService.Instance,
    private readonly measurements = CustomerMeasurementRepository.Instance,
  ) {}

  // ── The customer portal

  async view(token: string): Promise<PortalDTO> {
    const { customer, business } = await this.resolve(token);
    const scope = { businessId: business.id, customerId: customer.id };

    const [orders, appointments, payments, requests, designs, latestMeasurements] = await Promise.all([
      this.orders.listForBusiness({
        ...scope,
        page: 1,
        limit: PORTAL_LIMITS.orders,
        sort: "recent",
        today: localDay(new Date(), business.timeZone),
      }),
      this.appointments.listForBusiness({
        ...scope,
        page: 1,
        limit: PORTAL_LIMITS.appointments,
        order: "asc",
        status: "scheduled",
        from: new Date(),
        timeZone: business.timeZone,
      }),
      this.payments.listForBusiness({ ...scope, page: 1, limit: PORTAL_LIMITS.payments }),
      this.requests.listForBusiness({ ...scope, page: 1, limit: PORTAL_LIMITS.requests }),
      this.designs.forCustomers(business.id, PORTAL_LIMITS.designs),
      this.measurements.listForCustomer({ ...scope, page: 1, limit: 1 }),
    ]);
    const items = await this.orders.findItemsForOrders(orders.data.map((order) => order.id));
    const latest = latestMeasurements.data[0];

    return {
      business: this.publicBusiness(business),
      customer: { fullName: customer.fullName, gender: customer.gender },
      // Only what the customer needs to see: no notes, no staff member.
      measurements: latest
        ? { measuredOn: latest.measuredOn, unit: latest.unit, templateName: latest.templateName, values: latest.values }
        : null,
      orders: orders.data.map((order) => {
        const lines = items.get(order.id) ?? [];
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          dueDate: order.dueDate,
          totalAmount: order.totalAmount,
          amountPaid: order.amountPaid,
          balance: balanceDue(order.status === "cancelled", order.totalAmount, order.amountPaid),
          pricePending: lines.some((line) => line.pricePending),
          estimateMin: estimatedMinTotal(lines),
          estimateMax: estimatedMaxTotal(lines),
          discountTotal: orderDiscount(lines),
          items: lines.map(({ garmentName, quantity }) => ({ garmentName, quantity })),
          createdAt: order.createdAt,
        };
      }),
      appointments: appointments.data.map((a) => ({
        id: a.id,
        type: a.type,
        startsAt: a.startsAt,
        durationMinutes: a.durationMinutes,
        confirmedAt: a.customerConfirmedAt,
      })),
      payments: payments.data
        .filter((payment) => payment.kind !== "void")
        .map((payment) => ({
          id: payment.id,
          receiptNumber: payment.receiptNumber,
          kind: payment.kind,
          amount: payment.amount,
          paidAt: payment.paidAt,
          voided: payment.voided,
        })),
      requests: requests.data.map((request) => ({
        id: request.id,
        type: request.type,
        preferredStartsAt: request.preferredStartsAt,
        status: request.status,
        createdAt: request.createdAt,
      })),
      designs,
    };
  }

  /** A receipt PDF — only for this customer's own payments. */
  async receiptPdf(token: string, paymentId: string): Promise<{ filename: string; content: Buffer }> {
    const { customer, business } = await this.resolve(token);
    const payment = await this.payments.findInBusiness(paymentId, business.id);
    if (!payment || payment.customerId !== customer.id || payment.kind === "void") {
      throw AppError.notFound("Receipt not found");
    }
    const receipt = await this.paymentService.receiptFor(business.id, paymentId);
    return { filename: `Receipt-${receipt.receiptNumber}.pdf`, content: await renderReceiptPdf(receipt) };
  }

  /** "I'll be there" (PRD §4.7). Safe to repeat. The staff member is told in the app. */
  async confirmAppointment(token: string, appointmentId: string): Promise<{ confirmedAt: Date }> {
    const { customer, business } = await this.resolve(token);
    return runInTransaction(async (tx) => {
      const appointment = await this.appointments.findForUpdate(appointmentId, business.id, tx);
      if (!appointment || appointment.customerId !== customer.id) throw AppError.notFound("Appointment not found");
      if (appointment.status !== "scheduled" || appointment.startsAt.getTime() <= Date.now()) {
        throw AppError.conflict("This appointment can no longer be confirmed");
      }
      if (appointment.customerConfirmedAt) return { confirmedAt: appointment.customerConfirmedAt };

      const confirmedAt = new Date();
      await this.appointments.updateAppointment(appointmentId, business.id, { customerConfirmedAt: confirmedAt }, tx);
      await this.activity.audit(
        {
          businessId: business.id,
          actorId: null,
          action: "appointment.customer_confirmed",
          entityType: "appointment",
          entityId: appointmentId,
        },
        tx,
      );
      const staff = appointment.assignedTo ?? appointment.createdBy;
      if (staff) {
        await this.notifications.notify(
          {
            businessId: business.id,
            userIds: [staff],
            type: "appointment.confirmed",
            title: `${customer.fullName} confirmed their ${(APPOINTMENT_TYPE_LABELS[appointment.type] ?? appointment.type).toLowerCase()}`,
            linkPath: `/appointments/${appointmentId}`,
            dedupeKey: (userId) =>
              `appointment.confirmed:${appointmentId}:${appointment.startsAt.toISOString()}:${userId}`,
          },
          tx,
        );
      }
      return { confirmedAt };
    });
  }

  /** A request from a known customer: their name and number come from the record, not the form. */
  async requestFromPortal(token: string, input: PortalRequestInput): Promise<AppointmentRequestRecord> {
    const { customer, business } = await this.resolve(token);
    return this.requestService.submit(business, {
      customerId: customer.id,
      source: "portal",
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      type: input.type,
      preferredStartsAt: input.preferredStartsAt,
      note: input.note ?? null,
    });
  }

  // ── The public booking page

  async bookingPage(slug: string): Promise<BookingPageDTO> {
    const business = await this.bookableBusiness(slug);
    return {
      business: this.publicBusiness(business),
      appointmentTypes: APPOINTMENT_TYPES.map((value) => ({ value, label: APPOINTMENT_TYPE_LABELS[value] ?? value })),
      designs: await this.designs.forCustomers(business.id, PORTAL_LIMITS.designs),
    };
  }

  async requestFromBookingPage(slug: string, input: BookingRequestInput): Promise<{ id: string; status: string }> {
    const business = await this.bookableBusiness(slug);
    const request = await this.requestService.submit(business, {
      customerId: null,
      source: "booking_page",
      fullName: input.fullName,
      phone: input.phone,
      email: input.email ?? null,
      type: input.type,
      preferredStartsAt: input.preferredStartsAt,
      note: input.note ?? null,
    });
    // Nothing about the business's other records goes back to an anonymous caller.
    return { id: request.id, status: request.status };
  }

  // ── Helpers

  private async resolve(token: string): Promise<{ customer: CustomerRecord; business: BusinessRecord }> {
    const customer = await this.customers.findByPortalHash(sha256(token));
    if (!customer) throw AppError.notFound(NOT_FOUND);
    const business = await this.businesses.findBusiness(customer.businessId);
    if (!business || business.status !== "active") throw AppError.notFound(NOT_FOUND);
    return { customer, business };
  }

  private async bookableBusiness(slug: string): Promise<BusinessRecord> {
    const business = await this.businesses.findBySlug(slug);
    if (!business || !business.bookingEnabled || business.status !== "active") {
      throw AppError.notFound("Page not found");
    }
    return business;
  }

  private publicBusiness(business: BusinessRecord): PublicBusinessDTO {
    return {
      name: business.name,
      phone: business.phone,
      email: business.email,
      address: business.address,
      timeZone: business.timeZone,
      currency: business.currency,
      bookingUrl: business.bookingEnabled && business.slug ? `${env.appUrl}/book/${business.slug}` : null,
    };
  }
}
