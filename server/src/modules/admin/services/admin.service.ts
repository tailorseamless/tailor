import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { ActivityService } from "../../activity/services/activity.service";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { UserService } from "../../users/services/user.service";
import type { AdminBusinessDTO, AdminUserDTO, PlatformOverviewDTO } from "../dto/admin.dto";
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
   * touch. The audit entry (in that business's log) records what each field was and became.
   */
  async updateBusinessProfile(actor: Actor, id: string, input: UpdateBusinessProfileInput): Promise<AdminBusinessDTO> {
    const { reason, ...changes } = input;
    await runInTransaction(async (tx) => {
      const before = await this.businessRows.findBusiness(id, tx);
      if (!before) throw AppError.notFound("Business not found");
      const updated = await this.businessRows.updateBusiness(id, changes, tx);
      if (!updated) throw AppError.notFound("Business not found");
      const fields = Object.keys(changes) as (keyof typeof changes)[];
      await this.activity.audit(
        {
          businessId: id,
          actorId: actor.id,
          action: "admin.business_updated",
          entityType: "business",
          entityId: id,
          payload: {
            reason: reason ?? null,
            changes: Object.fromEntries(fields.map((field) => [field, { from: before[field], to: updated[field] }])),
          },
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
      await this.admin.setUserStatus(id, status, tx);
      await this.activity.audit(
        {
          businessId: user.businessId,
          actorId: actor.id,
          action: status === "disabled" ? "admin.user_disabled" : "admin.user_enabled",
          entityType: "user",
          entityId: id,
          payload: { reason: reason ?? null },
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
