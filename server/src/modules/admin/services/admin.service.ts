import { env } from "../../../config/env";
import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import type { ListAuditParams } from "../../activity/dto/activity.dto";
import type { AuditPage } from "../../activity/repositories/audit.repository";
import { ActivityService } from "../../activity/services/activity.service";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { UserService } from "../../users/services/user.service";
import { auditedChanges, canChangeCurrency } from "../domain/adminRules";
import type { AdminBusinessDTO, AdminUserDTO, PlatformAdminDTO, PlatformOverviewDTO } from "../dto/admin.dto";
import { AdminRepository } from "../repositories/admin.repository";
import type { ListBusinessesQuery, ListUsersQuery, UpdateBusinessProfileInput } from "../validators/admin.schema";

/**
 * The platform admin area. Every change is written to the audit log of the
 * business it affects, with the admin as the actor, and takes effect at once
 * (cached sign-ins are dropped).
 */
export class AdminService {
  static Instance = new AdminService();

  private constructor(
    private readonly admin = AdminRepository.Instance,
    private readonly activity = ActivityService.Instance,
    private readonly userService = UserService.Instance,
    private readonly businessRows = BusinessRepository.Instance,
  ) {}

  overview(): Promise<PlatformOverviewDTO> {
    return this.admin.overview();
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
