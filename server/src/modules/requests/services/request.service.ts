import { PUBLIC } from "../../../config/constants";
import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { APPOINTMENT_TYPE_LABELS, formatShortDateTime } from "../../../shared/utils/format";
import { localDay } from "../../../shared/utils/timezone";
import type { AuditAction } from "../../activity/dto/activity.dto";
import { ActivityService } from "../../activity/services/activity.service";
import type { AppointmentDTO } from "../../appointments/dto/appointment.dto";
import { AppointmentService } from "../../appointments/services/appointment.service";
import type { BusinessRecord } from "../../businesses/dto/business.dto";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { MemberRepository } from "../../businesses/repositories/member.repository";
import { CustomerRepository } from "../../customers/repositories/customer.repository";
import { DesignService } from "../../designs/services/design.service";
import { CustomerMeasurementRepository } from "../../measurements/repositories/customerMeasurement.repository";
import { EmailOutboxService } from "../../notifications/services/emailOutbox.service";
import { NotificationService } from "../../notifications/services/notification.service";
import type { AppointmentRequestDTO, AppointmentRequestRecord, NewRequestInput } from "../dto/request.dto";
import { RequestRepository } from "../repositories/request.repository";
import type { AcceptRequestInput, DeclineRequestInput, ListRequestsQuery } from "../validators/request.schema";

/** Who hears about a new request: the people who book appointments. */
const BOOKERS = ["owner", "manager", "tailor", "receptionist"] as const;

/**
 * Online appointment requests (PRD Phase 3). A request never books anything
 * by itself: staff accept it (which creates the appointment, and the customer
 * if they are new) or decline it. Either way the person is emailed when they
 * gave an address.
 */
export class RequestService {
  static Instance = new RequestService();

  private constructor(
    private readonly requests = RequestRepository.Instance,
    private readonly customers = CustomerRepository.Instance,
    private readonly businesses = BusinessRepository.Instance,
    private readonly members = MemberRepository.Instance,
    private readonly appointments = AppointmentService.Instance,
    private readonly notifications = NotificationService.Instance,
    private readonly emails = EmailOutboxService.Instance,
    private readonly activity = ActivityService.Instance,
    private readonly measurements = CustomerMeasurementRepository.Instance,
    private readonly designs = DesignService.Instance,
  ) {}

  async list(actor: Actor, query: ListRequestsQuery): Promise<Paginated<AppointmentRequestDTO>> {
    const page = await this.requests.listForBusiness({ ...query, businessId: actor.businessId }); // tenant scope, always
    return { data: await this.withDesigns(actor.businessId, page.data), meta: page.meta };
  }

  async detail(actor: Actor, id: string): Promise<AppointmentRequestDTO> {
    const request = await this.requests.findInBusiness(id, actor.businessId);
    if (!request) throw AppError.notFound("Request not found");
    return (await this.withDesigns(actor.businessId, [request]))[0];
  }

  /** Each request with the design it was made from: one lookup for the whole page, not one per row. */
  private async withDesigns(businessId: string, records: AppointmentRequestRecord[]): Promise<AppointmentRequestDTO[]> {
    const designs = await this.designs.summaries(
      businessId,
      records.flatMap((r) => (r.designId ? [r.designId] : [])),
    );
    return records.map((r) => ({ ...r, design: r.designId ? (designs.get(r.designId) ?? null) : null }));
  }

  /** From the portal or the booking page — no signed-in actor. Staff are told in the app. */
  async submit(
    business: BusinessRecord,
    input: Omit<NewRequestInput, "businessId">,
  ): Promise<AppointmentRequestRecord> {
    if ((await this.requests.countPendingForPhone(business.id, input.phone)) >= PUBLIC.maxPendingRequestsPerPhone) {
      throw new AppError("You already have requests waiting. We will be in touch soon.", 429);
    }
    return runInTransaction(async (tx) => {
      const request = await this.requests.createRequest({ ...input, businessId: business.id }, tx);
      await this.activity.audit(
        {
          businessId: business.id,
          actorId: null,
          action: "appointment_request.created",
          entityType: "appointment_request",
          entityId: request.id,
          payload: { source: input.source, type: input.type },
        },
        tx,
      );
      const staff = await this.members.activeUserIdsWithRoles(business.id, [...BOOKERS], tx);
      await this.notifications.notify(
        {
          businessId: business.id,
          userIds: staff,
          type: "appointment.requested",
          title: `${input.fullName} asked for a ${(APPOINTMENT_TYPE_LABELS[input.type] ?? input.type).toLowerCase()}`,
          body:
            `Around ${formatShortDateTime(input.preferredStartsAt, business.timeZone)}` +
            (input.measurements?.length ? " · sent their measurements" : ""),
          // Requests wait in the diary's Requests tab; there is no page of their own.
          linkPath: "/appointments?tab=requests",
          dedupeKey: (userId) => `appointment.requested:${request.id}:${userId}`,
        },
        tx,
      );
      if (input.email) {
        await this.emails.queue(
          {
            businessId: business.id,
            kind: "appointment.request_received",
            to: input.email,
            toName: input.fullName,
            payload: {
              businessName: business.name,
              name: input.fullName,
              type: input.type,
              preferredStartsAt: input.preferredStartsAt.toISOString(),
              timeZone: business.timeZone,
            },
            dedupeKey: `appointment.request_received:${request.id}`,
          },
          tx,
        );
      }
      return request;
    });
  }

  /**
   * Books it: finds the customer (the portal's, or a customer of this business
   * with the same phone number, or a new one), creates the appointment through
   * the normal rules (clash check included) — all in one transaction.
   */
  async accept(
    actor: Actor,
    id: string,
    input: AcceptRequestInput,
  ): Promise<{ request: AppointmentRequestRecord; appointment: AppointmentDTO; customerCreated: boolean }> {
    const business = await this.business(actor);
    return runInTransaction(async (tx) => {
      const request = await this.pending(actor, id, tx);
      const { customerId, created: customerCreated } = await this.customerFor(actor, request, tx);
      await this.keepMeasurements(actor, business, request, customerId, tx);
      const appointment = await this.appointments.create(
        actor,
        {
          customerId,
          type: request.type,
          startsAt: input.startsAt ?? request.preferredStartsAt,
          durationMinutes: input.durationMinutes,
          assignedTo: input.assignedTo,
          branchId: input.branchId,
          reminderMinutesBefore: 60,
          notes: request.note,
          confirmClash: input.confirmClash,
        },
        tx,
      );
      await this.requests.decide(
        id,
        actor.businessId,
        {
          status: "accepted",
          decidedBy: actor.id,
          decisionNote: input.note ?? null,
          appointmentId: appointment.id,
          customerId,
        },
        tx,
      );
      await this.audit(actor, "appointment_request.accepted", id, { appointmentId: appointment.id }, tx);
      await this.queueDecision(business, request, "accepted", new Date(appointment.startsAt), input.note ?? null, tx);
      return { request: (await this.requests.findInBusiness(id, actor.businessId, tx))!, appointment, customerCreated };
    });
  }

  async decline(actor: Actor, id: string, input: DeclineRequestInput): Promise<AppointmentRequestRecord> {
    const business = await this.business(actor);
    return runInTransaction(async (tx) => {
      const request = await this.pending(actor, id, tx);
      await this.requests.decide(
        id,
        actor.businessId,
        { status: "declined", decidedBy: actor.id, decisionNote: input.note ?? null },
        tx,
      );
      await this.audit(actor, "appointment_request.declined", id, {}, tx);
      await this.queueDecision(business, request, "declined", null, input.note ?? null, tx);
      return (await this.requests.findInBusiness(id, actor.businessId, tx))!;
    });
  }

  private async pending(actor: Actor, id: string, tx: Tx): Promise<AppointmentRequestRecord> {
    const request = await this.requests.findForUpdate(id, actor.businessId, tx);
    if (!request) throw AppError.notFound("Request not found");
    if (request.status !== "pending") throw AppError.conflict(`This request was already ${request.status}`);
    return request;
  }

  /** The customer a request is for, and whether accepting it just created them. */
  private async customerFor(
    actor: Actor,
    request: AppointmentRequestRecord,
    tx: Tx,
  ): Promise<{ customerId: string; created: boolean }> {
    if (request.customerId && (await this.customers.findInBusiness(request.customerId, actor.businessId, tx))) {
      return { customerId: request.customerId, created: false };
    }
    const known = await this.customers.findByPhone(actor.businessId, request.phone, undefined, tx);
    if (known) return { customerId: known.id, created: false };
    const created = await this.customers.createCustomer(
      {
        businessId: actor.businessId,
        fullName: request.fullName,
        phone: request.phone,
        email: request.email,
        createdBy: actor.id,
      },
      tx,
    );
    await this.activity.audit(
      {
        businessId: actor.businessId,
        actorId: actor.id,
        action: "customer.created",
        entityType: "customer",
        entityId: created.id,
        payload: { fromRequest: request.id },
      },
      tx,
    );
    return { customerId: created.id, created: true };
  }

  /**
   * Measurements the customer sent become an ordinary record, marked as theirs: the numbers were taken by someone
   * else, so staff can tell them apart from what they measured themselves.
   */
  private async keepMeasurements(
    actor: Actor,
    business: BusinessRecord,
    request: AppointmentRequestRecord,
    customerId: string,
    tx: Tx,
  ): Promise<void> {
    if (!request.measurements?.length) return;
    const saved = await this.measurements.createMeasurement(
      {
        businessId: actor.businessId,
        customerId,
        templateId: null,
        templateName: null,
        unit: request.measurementUnit ?? business.measurementUnit,
        measuredOn: localDay(request.createdAt, business.timeZone),
        notes: "Sent by the customer with their appointment request. Taken by another tailor.",
        values: request.measurements,
        source: "customer",
        recordedBy: actor.id,
      },
      tx,
    );
    await this.activity.audit(
      {
        businessId: actor.businessId,
        actorId: actor.id,
        action: "measurement.recorded",
        entityType: "customer_measurement",
        entityId: saved.id,
        payload: { customerId, fromRequest: request.id, source: "customer" },
      },
      tx,
    );
  }

  private async queueDecision(
    business: BusinessRecord,
    request: AppointmentRequestRecord,
    decision: "accepted" | "declined",
    startsAt: Date | null,
    note: string | null,
    tx: Tx,
  ): Promise<void> {
    if (!request.email) return;
    await this.emails.queue(
      {
        businessId: business.id,
        kind: "appointment.request_decided",
        to: request.email,
        toName: request.fullName,
        payload: {
          businessName: business.name,
          businessPhone: business.phone,
          name: request.fullName,
          type: request.type,
          decision,
          startsAt: startsAt?.toISOString() ?? null,
          timeZone: business.timeZone,
          note,
        },
        dedupeKey: `appointment.request_decided:${request.id}`,
      },
      tx,
    );
  }

  private async business(actor: Actor): Promise<BusinessRecord> {
    const business = await this.businesses.findBusiness(actor.businessId);
    if (!business) throw AppError.notFound("Business not found");
    return business;
  }

  private audit(actor: Actor, action: AuditAction, id: string, payload: Record<string, unknown>, tx: Tx) {
    return this.activity.audit(
      {
        businessId: actor.businessId,
        actorId: actor.id,
        action,
        entityType: "appointment_request",
        entityId: id,
        payload,
      },
      tx,
    );
  }
}
