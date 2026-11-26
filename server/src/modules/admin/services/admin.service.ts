import { VIEW_NOTE_EVERY_MS } from "../../../config/constants";
import { env } from "../../../config/env";
import { hasPermission } from "../../../config/permissions";
import { logger } from "../../../infrastructure/logger/logger";
import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import type { ListAuditParams } from "../../activity/dto/activity.dto";
import type { AuditPage } from "../../activity/repositories/audit.repository";
import { ActivityService } from "../../activity/services/activity.service";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { BusinessService } from "../../businesses/services/business.service";
import { DesignService } from "../../designs/services/design.service";
import { NotificationService } from "../../notifications/services/notification.service";
import { UserService } from "../../users/services/user.service";
import type { SystemHealthDTO } from "../../system/dto/system.dto";
import { SystemHealthService } from "../../system/services/systemHealth.service";
import { auditedChanges, canChangeCurrency } from "../domain/adminRules";
import type {
  AdminBusinessDetailDTO,
  AdminBusinessDTO,
  AdminUserDetailDTO,
  AdminUserDTO,
  PlatformAdminDTO,
  PlatformOverviewDTO,
} from "../dto/admin.dto";
import type { AdminAlertDTO, ListAlertsParams } from "../dto/alert.dto";
import { AdminRepository } from "../repositories/admin.repository";
import { AlertRepository } from "../repositories/alert.repository";
import { AlertService } from "./alert.service";
import { InsightsService } from "./insights.service";
import type {
  ListBusinessesQuery,
  ListUsersQuery,
  SwitchOnInput,
  UpdateBusinessProfileInput,
} from "../validators/admin.schema";

/**
 * The platform admin area. Every change is written to the audit log of the
 * business it affects, with the admin as the actor, and takes effect at once
 * (cached sign-ins are dropped).
 */
export class AdminService {
  static Instance = new AdminService();

  /** When each admin last had a view of a business or person recorded (see `noteView`). */
  private readonly viewsNoted = new Map<string, number>();

  private constructor(
    private readonly admin = AdminRepository.Instance,
    private readonly activity = ActivityService.Instance,
    private readonly userService = UserService.Instance,
    private readonly businessRows = BusinessRepository.Instance,
    private readonly alerts = AlertRepository.Instance,
    private readonly alertService = AlertService.Instance,
    private readonly health = SystemHealthService.Instance,
    private readonly businessService = BusinessService.Instance,
    private readonly designs = DesignService.Instance,
    private readonly notifications = NotificationService.Instance,
  ) {}

  async overview(): Promise<PlatformOverviewDTO> {
    const [counts, alerts] = await Promise.all([this.admin.overview(), this.alerts.openCounts()]);
    return { ...counts, alerts };
  }

  /** Business 360. Opening it is recorded in that business's audit log (once an hour per admin). */
  async businessDetail(actor: Actor, id: string): Promise<AdminBusinessDetailDTO> {
    const business = await this.business(id);
    const [detail, openAlerts, risk] = await Promise.all([
      this.admin.businessDetail(id),
      this.admin.openAlertsFor(id),
      InsightsService.Instance.churnRiskFor(id),
    ]);
    await this.noteView(actor, "admin.viewed_business", "business", id, id);
    return {
      business,
      ...detail,
      openAlerts,
      churnRisk: risk ? { score: risk.score, level: risk.level, reasons: risk.reasons } : null,
    };
  }

  /** User 360. Opening it is recorded in their business's audit log (once an hour per admin). */
  async userDetail(actor: Actor, id: string): Promise<AdminUserDetailDTO> {
    const [user, extra] = await Promise.all([this.admin.findUser(id), this.admin.userDetail(id)]);
    if (!user || !extra) throw AppError.notFound("Person not found");
    await this.noteView(actor, "admin.viewed_user", "user", id, user.businessId);
    return {
      user: {
        ...user,
        timeZone: extra.timeZone,
        deletionScheduledFor: extra.deletionScheduledFor,
        onboarding: extra.onboarding,
        memberStatus: extra.memberStatus,
        adminBySetting: env.platformAdmins.has(user.email),
      },
      actions: { total: extra.actionsTotal, last30Days: extra.actionsLast30Days },
    };
  }

  /** What is happening across the platform: joins, team changes, departures, admin actions. */
  feed(params: Omit<ListAuditParams, "actions" | "actorId" | "entityType" | "entityId">) {
    return this.activity.feed(params);
  }

  /** Is the application healthy? Error text only for `admin.technical`. */
  systemHealth(actor: Actor): Promise<SystemHealthDTO> {
    return this.health.check({ technical: hasPermission(actor.roles, "admin.technical") });
  }

  alertsList(params: ListAlertsParams): Promise<Paginated<AdminAlertDTO>> {
    return this.alertService.list(params);
  }

  acknowledgeAlert(actor: Actor, id: string): Promise<AdminAlertDTO> {
    return this.alertService.acknowledge(actor, id);
  }

  resolveAlert(actor: Actor, id: string, note: string | null): Promise<AdminAlertDTO> {
    return this.alertService.resolve(actor, id, note);
  }

  /**
   * Admins looking at a business or a person is itself on the record (who looked at whom). Repeats
   * within the hour by the same admin are not written again. A failure to record never blocks the view.
   */
  private async noteView(
    actor: Actor,
    action: "admin.viewed_business" | "admin.viewed_user",
    entityType: "business" | "user",
    entityId: string,
    businessId: string,
  ): Promise<void> {
    const key = `${actor.id}:${action}:${entityId}`;
    const now = Date.now();
    const last = this.viewsNoted.get(key);
    if (last !== undefined && now - last < VIEW_NOTE_EVERY_MS) return;
    this.viewsNoted.set(key, now);
    await this.activity
      .audit({ businessId, actorId: actor.id, action, entityType, entityId })
      .catch((err: unknown) => logger.warn({ err, action, entityId }, "admin view not recorded"));
  }

  businesses(query: ListBusinessesQuery): Promise<Paginated<AdminBusinessDTO>> {
    return this.admin.listBusinesses(query);
  }

  async business(id: string): Promise<AdminBusinessDTO> {
    const business = await this.admin.findBusiness(id);
    if (!business) throw AppError.notFound("Business not found");
    return business;
  }

  /** Who holds platform power right now, from the database and from PLATFORM_ADMIN_EMAILS. */
  admins(): Promise<PlatformAdminDTO[]> {
    return this.admin.listPlatformAdmins([...env.platformAdmins]);
  }

  /** The raw audit trail across every business. */
  auditLogs(params: ListAuditParams): Promise<AuditPage> {
    return this.activity.list(params);
  }

  /** Suspending a business signs all its people out of it and closes its public pages. */
  async setBusinessStatus(
    actor: Actor,
    id: string,
    status: "active" | "suspended",
    reason: string | null | undefined,
  ): Promise<AdminBusinessDTO> {
    if (id === actor.businessId && status === "suspended") {
      throw AppError.conflict("You cannot suspend your own business");
    }
    await runInTransaction(async (tx) => {
      const business = await this.admin.findBusiness(id, tx);
      if (!business) throw AppError.notFound("Business not found");
      if (business.status === status) return;
      await this.admin.setBusinessStatus(id, status, tx);
      await this.activity.audit(
        {
          businessId: id,
          actorId: actor.id,
          action: status === "suspended" ? "admin.business_suspended" : "admin.business_reactivated",
          entityType: "business",
          entityId: id,
          payload: { reason: reason ?? null },
        },
        tx,
      );
    });
    this.userService.invalidateBusiness(id);
    return this.business(id);
  }

  /**
   * Changes a business's details, including the email, currency and time zone its owner can't
   * touch. The audit entry (in that business's log) records what each field was and became, except
   * contact details, which are recorded as changed without their values. The currency is locked
   * once the business has taken a payment.
   */
  async updateBusinessProfile(actor: Actor, id: string, input: UpdateBusinessProfileInput): Promise<AdminBusinessDTO> {
    const { reason, ...changes } = input;
    await runInTransaction(async (tx) => {
      const before = await this.businessRows.findBusiness(id, tx);
      if (!before) throw AppError.notFound("Business not found");
      if (
        changes.currency !== undefined &&
        changes.currency !== before.currency &&
        !canChangeCurrency(before.currency, changes.currency, await this.admin.businessHasPayments(id, tx))
      ) {
        throw AppError.conflict("This business has taken payments, so its currency can no longer change", [
          { field: "currency", message: "locked_after_payments" },
        ]);
      }
      const updated = await this.businessRows.updateBusiness(id, changes, tx);
      if (!updated) throw AppError.notFound("Business not found");
      const fields = Object.keys(changes) as (keyof typeof changes & string)[];
      await this.activity.audit(
        {
          businessId: id,
          actorId: actor.id,
          action: "admin.business_updated",
          entityType: "business",
          entityId: id,
          payload: { reason: reason ?? null, changes: auditedChanges(before, updated, fields) },
        },
        tx,
      );
    });
    this.userService.invalidateBusiness(id); // the time zone is part of what signed-in people have cached
    return this.business(id);
  }

  /**
   * Does for a business what the app's own offers of help do, for an owner who asks support to. The admin never
   * sees the designs, so every hidden one with a photo is switched on. Bank details are deliberately not here:
   * only the business says where its customers' money goes. The reason is kept in the business's audit log and
   * the owner is told, so they can switch anything back off.
   */
  async switchOn(
    actor: Actor,
    id: string,
    input: SwitchOnInput,
  ): Promise<{ designsShown: number; pagePublished: boolean; bookingOpened: boolean }> {
    return runInTransaction(async (tx) => {
      const business = await this.admin.findBusiness(id, tx);
      if (!business) throw AppError.notFound("Business not found");
      if (business.status !== "active" || business.deletionScheduledFor) {
        throw AppError.conflict("This business is suspended or closing, so nothing can be switched on for it");
      }
      // The page first: appointment requests need it on.
      const pagePublished = input.page && (await this.businessService.publishPageFor(id, tx));
      const bookingOpened = input.booking && (await this.businessService.openBookingFor(id, tx));
      const designIds = input.designs ? await this.designs.showAllFor(id, tx) : [];
      const result = { designsShown: designIds.length, pagePublished, bookingOpened };
      const what = [
        designIds.length > 0 && `${designIds.length} design${designIds.length === 1 ? "" : "s"}`,
        pagePublished && "your public page",
        bookingOpened && "appointment requests",
      ].filter((part): part is string => Boolean(part));
      if (what.length === 0) return result; // already so: nothing to record or announce

      await this.activity.audit(
        {
          businessId: id,
          actorId: actor.id,
          action: "admin.switched_on",
          entityType: "business",
          entityId: id,
          payload: { reason: input.reason, pagePublished, bookingOpened, designIds },
        },
        tx,
      );
      if (business.owner) {
        await this.notifications.notify(
          {
            businessId: id,
            userIds: [business.owner.id],
            type: "platform.support_change",
            title: `Tailor Seamless support switched on ${what.join(", ")}`,
            body: "If you didn't want this, you can switch designs off in Designs, and your page or appointment requests off in Settings.",
            linkPath: "/designs",
          },
          tx,
        );
      }
      return result;
    });
  }

  users(query: ListUsersQuery): Promise<Paginated<AdminUserDTO>> {
    return this.admin.listUsers(query);
  }

  async setUserStatus(
    actor: Actor,
    id: string,
    status: "active" | "disabled",
    reason: string | null | undefined,
  ): Promise<AdminUserDTO> {
    if (id === actor.id) throw AppError.conflict("You cannot change your own account here");
    await runInTransaction(async (tx) => {
      const user = await this.admin.findUser(id, tx);
      if (!user) throw AppError.notFound("Person not found");
      if (user.status === status) return;
      // Only a super admin may lock out another platform admin. `admin.manage` is super-admin only
      // today; this still holds if that ever widens.
      const targetIsAdmin = user.platformRole !== "user" || env.platformAdmins.has(user.email);
      if (targetIsAdmin && status === "disabled" && actor.platformRole !== "super_admin") {
        throw AppError.forbidden("Only a super admin can disable another platform admin");
      }
      await this.admin.setUserStatus(id, status, tx);
      await this.activity.audit(
        {
          businessId: user.businessId,
          actorId: actor.id,
          action: status === "disabled" ? "admin.user_disabled" : "admin.user_enabled",
          entityType: "user",
          entityId: id,
          payload: { reason: reason ?? null, ...(targetIsAdmin ? { targetWasPlatformAdmin: true } : {}) },
        },
        tx,
      );
    });
    this.userService.invalidate(id);
    const user = await this.admin.findUser(id);
    if (!user) throw AppError.notFound("Person not found");
    return user;
  }
}
