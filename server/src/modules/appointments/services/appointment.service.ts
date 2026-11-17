import { JOBS } from "../../../config/constants";
import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, withTx, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import type { AuditAction } from "../../activity/dto/activity.dto";
import { ActivityService } from "../../activity/services/activity.service";
import { BranchService } from "../../branches/services/branch.service";
import { MemberRepository } from "../../businesses/repositories/member.repository";
import { CustomerRepository } from "../../customers/repositories/customer.repository";
import { EmailOutboxService } from "../../notifications/services/emailOutbox.service";
import { NotificationService } from "../../notifications/services/notification.service";
import { OrderRepository } from "../../orders/repositories/order.repository";
import { canCloseAppointment, canEditAppointment, canReschedule, statusLabel } from "../domain/appointmentStatus";
import { localTime, reminderText } from "../domain/reminderText";
import type { AppointmentDTO, AppointmentRecord, AppointmentSlot } from "../dto/appointment.dto";
import { AppointmentRepository } from "../repositories/appointment.repository";
import type {
  CloseAppointmentInput,
  CreateAppointmentInput,
  ListAppointmentsQuery,
  RescheduleAppointmentInput,
  UpdateAppointmentInput,
} from "../validators/appointment.schema";

export class AppointmentService {
  static Instance = new AppointmentService();

  private constructor(
    private readonly appointments = AppointmentRepository.Instance,
    private readonly customers = CustomerRepository.Instance,
    private readonly orders = OrderRepository.Instance,
    private readonly members = MemberRepository.Instance,
    private readonly branches = BranchService.Instance,
    private readonly notifications = NotificationService.Instance,
    private readonly emails = EmailOutboxService.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  /** The diary, soonest first (PRD US-042). `day` is a calendar day where the caller is. */
  list(actor: Actor, query: ListAppointmentsQuery): Promise<Paginated<AppointmentDTO>> {
    return this.appointments.listForBusiness({ ...query, businessId: actor.businessId, timeZone: actor.timeZone });
  }

  /** Another business's appointment is a 404: existence must not leak. */
  async detail(actor: Actor, id: string): Promise<AppointmentDTO> {
    const appointment = await this.appointments.findInBusiness(id, actor.businessId);
    if (!appointment) throw AppError.notFound("Appointment not found");
    return appointment;
  }

  /** PRD US-039, US-040. */
  /** `outerTx`: join the caller's transaction (accepting an online request). */
  async create(actor: Actor, input: CreateAppointmentInput, outerTx?: Tx): Promise<AppointmentDTO> {
    const { confirmClash, ...fields } = input;
    return withTx(outerTx, async (tx) => {
      if (!(await this.customers.findInBusiness(fields.customerId, actor.businessId, tx))) {
        throw AppError.unprocessable("Choose a customer that exists", [{ field: "customerId", message: "Not found" }]);
      }
      await this.assertOrder(actor, fields.customerId, fields.orderId, tx);
      await this.assertAssignee(actor, fields.assignedTo, tx);
      const assignedTo = fields.assignedTo ?? null;
      if (!confirmClash) await this.assertNoClash(actor, { ...fields, assignedTo }, undefined, tx);

      const id = await this.appointments.createAppointment(
        {
          businessId: actor.businessId,
          customerId: fields.customerId,
          orderId: fields.orderId ?? null,
          branchId: await this.branches.resolve(actor, fields.branchId, tx),
          assignedTo,
          type: fields.type,
          startsAt: fields.startsAt,
          durationMinutes: fields.durationMinutes,
          reminderMinutesBefore: fields.reminderMinutesBefore,
          notes: fields.notes ?? null,
          createdBy: actor.id,
        },
        tx,
      );
      await this.audit(actor, "appointment.created", id, { customerId: fields.customerId, type: fields.type }, tx);
      return (await this.appointments.findInBusiness(id, actor.businessId, tx))!;
    });
  }

  /** Type, length, notes, reminder, staff and linked order — while it is still booked. The time moves with `reschedule`. */
  async update(actor: Actor, id: string, input: UpdateAppointmentInput): Promise<AppointmentDTO> {
    const { confirmClash, ...fields } = input;
    return runInTransaction(async (tx) => {
      const appointment = await this.lock(actor, id, tx);
      if (!canEditAppointment(appointment.status)) {
        throw AppError.conflict(`A ${statusLabel(appointment.status)} appointment cannot be changed`);
      }
      if (fields.orderId) await this.assertOrder(actor, appointment.customerId, fields.orderId, tx);
      await this.branches.assertActive(actor, fields.branchId, tx);
      await this.assertAssignee(actor, fields.assignedTo, tx);

      const changesSlot = fields.assignedTo !== undefined || fields.durationMinutes !== undefined;
      if (changesSlot && !confirmClash) {
        await this.assertNoClash(
          actor,
          {
            customerId: appointment.customerId,
            assignedTo: fields.assignedTo !== undefined ? fields.assignedTo : appointment.assignedTo,
            startsAt: appointment.startsAt,
            durationMinutes: fields.durationMinutes ?? appointment.durationMinutes,
          },
          id,
          tx,
        );
      }

      await this.appointments.updateAppointment(
        id,
        actor.businessId,
        // A changed lead time starts the reminder afresh.
        { ...fields, ...(fields.reminderMinutesBefore !== undefined ? { reminderSentAt: null } : {}) },
        tx,
      );
      await this.audit(actor, "appointment.updated", id, { fields: Object.keys(fields) }, tx);
      return (await this.appointments.findInBusiness(id, actor.businessId, tx))!;
    });
  }

  /** Moves a booked appointment, or rebooks a missed one (PRD US-041). The reminder is sent again for the new time. */
  async reschedule(actor: Actor, id: string, input: RescheduleAppointmentInput): Promise<AppointmentDTO> {
    return runInTransaction(async (tx) => {
      const appointment = await this.lock(actor, id, tx);
      if (!canReschedule(appointment.status)) {
        throw AppError.conflict(`A ${statusLabel(appointment.status)} appointment cannot be rescheduled`);
      }
      const durationMinutes = input.durationMinutes ?? appointment.durationMinutes;
      if (!input.confirmClash) {
        await this.assertNoClash(
          actor,
          {
            customerId: appointment.customerId,
            assignedTo: appointment.assignedTo,
            startsAt: input.startsAt,
            durationMinutes,
          },
          id,
          tx,
        );
      }

      await this.appointments.updateAppointment(
        id,
        actor.businessId,
        {
          startsAt: input.startsAt,
          durationMinutes,
          status: "scheduled",
          changeNote: input.reason ?? null,
          reminderSentAt: null,
          customerConfirmedAt: null, // a new time needs a new confirmation
        },
        tx,
      );
      await this.audit(
        actor,
        "appointment.rescheduled",
        id,
        { from: appointment.startsAt.toISOString(), to: input.startsAt.toISOString(), wasStatus: appointment.status },
        tx,
      );
      return (await this.appointments.findInBusiness(id, actor.businessId, tx))!;
    });
  }

  /** Completed, cancelled or missed — recorded with who and when in the audit log. */
  async close(actor: Actor, id: string, input: CloseAppointmentInput): Promise<AppointmentDTO> {
    return runInTransaction(async (tx) => {
      const appointment = await this.lock(actor, id, tx);
      if (!canCloseAppointment(appointment.status, input.status)) {
        throw AppError.conflict(`This appointment is already ${statusLabel(appointment.status)}`);
      }

      await this.appointments.updateAppointment(
        id,
        actor.businessId,
        { status: input.status, changeNote: input.note ?? null },
        tx,
      );
      await this.audit(actor, "appointment.status_changed", id, { from: appointment.status, to: input.status }, tx);
      return (await this.appointments.findInBusiness(id, actor.businessId, tx))!;
    });
  }

  /**
   * The reminder job's work. Safe to run twice or from two instances: claiming
   * a reminder and writing its notification happen in one transaction, and
   * the notification carries a dedupe key.
   */
  async sendDueReminders(limit: number = JOBS.reminderBatch): Promise<{ sent: number; emailed: number }> {
    return runInTransaction(async (tx) => {
      const due = await this.appointments.claimDueReminders(limit, tx);
      let sent = 0;
      let emailed = 0;
      for (const reminder of due) {
        const startsAt = new Date(reminder.startsAt).toISOString();
        // The customer, by email — built at send time, so a later change is not reminded wrongly.
        if (reminder.emailCustomer && reminder.customerEmail) {
          const queued = await this.emails.queue(
            {
              businessId: reminder.businessId,
              kind: "appointment.reminder",
              to: reminder.customerEmail,
              toName: reminder.customerName,
              payload: { appointmentId: reminder.id },
              dedupeKey: `appointment.reminder:${reminder.id}:${startsAt}`,
            },
            tx,
          );
          if (queued) emailed += 1;
        }
        // The staff member, in the app.
        const { userId } = reminder;
        if (!userId) continue;
        await this.notifications.notify(
          {
            businessId: reminder.businessId,
            userIds: [userId],
            type: "appointment.reminder",
            ...reminderText(reminder),
            linkPath: `/appointments/${reminder.id}`,
            dedupeKey: (user) =>
              `appointment.reminder:${reminder.id}:${new Date(reminder.startsAt).toISOString()}:${user}`,
          },
          tx,
        );
        sent += 1;
      }
      return { sent, emailed };
    });
  }

  private async lock(actor: Actor, id: string, tx: Tx): Promise<AppointmentRecord> {
    const appointment = await this.appointments.findForUpdate(id, actor.businessId, tx);
    if (!appointment) throw AppError.notFound("Appointment not found");
    return appointment;
  }

  /** A linked order must be this business's, and this customer's. */
  private async assertOrder(actor: Actor, customerId: string, orderId: string | null | undefined, tx: Tx) {
    if (!orderId) return;
    const order = await this.orders.findInBusiness(orderId, actor.businessId, tx);
    if (!order || order.customerId !== customerId) {
      throw AppError.unprocessable("Choose an order that belongs to this customer", [
        { field: "orderId", message: "Not found for this customer" },
      ]);
    }
  }

  /** Staff are assigned from this business's active members only. */
  private async assertAssignee(actor: Actor, userId: string | null | undefined, tx: Tx) {
    if (!userId) return;
    const membership = await this.members.findMembership(actor.businessId, userId, tx);
    if (!membership || membership.status !== "active") {
      throw AppError.unprocessable("Choose a member of your team", [{ field: "assignedTo", message: "Not found" }]);
    }
  }

  /** Flags a double booking; the client may resend with `confirmClash: true`. */
  private async assertNoClash(actor: Actor, slot: AppointmentSlot, exceptId: string | undefined, tx: Tx) {
    const clashes = await this.appointments.findClashes(actor.businessId, slot, exceptId, tx);
    if (clashes.length === 0) return;
    throw AppError.conflict(
      "This time overlaps another appointment",
      clashes.map((clash) => ({
        field: "startsAt",
        message: "clash",
        with: clash.customerId === slot.customerId ? "customer" : "staff",
        appointmentId: clash.id,
        customerName: clash.customerName,
        assignedName: clash.assignedName,
        startsAt: clash.startsAt,
        localTime: localTime(new Date(clash.startsAt), actor.timeZone),
        durationMinutes: clash.durationMinutes,
      })),
    );
  }

  private audit(actor: Actor, action: AuditAction, id: string, payload: Record<string, unknown>, tx: Tx) {
    return this.activity.audit(
      { businessId: actor.businessId, actorId: actor.id, action, entityType: "appointment", entityId: id, payload },
      tx,
    );
  }
}
