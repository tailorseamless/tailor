import { ACCOUNT_DELETION } from "../../../config/constants";
import { firebaseAdminConfigured, firebaseAuth } from "../../../infrastructure/firebase/firebaseAdmin";
import { logger } from "../../../infrastructure/logger/logger";
import { AppError } from "../../../shared/errors/AppError";
import { runInTransaction } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { StorageService } from "../../../shared/services/storage.service";
import { ActivityService } from "../../activity/services/activity.service";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { MemberRepository } from "../../businesses/repositories/member.repository";
import { UserRepository } from "../../users/repositories/user.repository";
import { UserService } from "../../users/services/user.service";
import { AccountDeletionRepository } from "../repositories/accountDeletion.repository";

const graceEnd = () => new Date(Date.now() + ACCOUNT_DELETION.graceDays * 86_400_000);

/**
 * Deleting an account or a whole business (Backend Guide §27.5). A request
 * starts a grace period (ACCOUNT_DELETION.graceDays) during which it can be
 * cancelled and everything keeps working. The `processAccountDeletions` job
 * then anonymises — names, contact details, logins and pictures go; orders and
 * payments stay, with no names, as the business's financial record.
 */
export class AccountDeletionService {
  static Instance = new AccountDeletionService();

  private constructor(
    private readonly deletions = AccountDeletionRepository.Instance,
    private readonly users = UserRepository.Instance,
    private readonly members = MemberRepository.Instance,
    private readonly businesses = BusinessRepository.Instance,
    private readonly storage = StorageService.Instance,
    private readonly activity = ActivityService.Instance,
    private readonly userService = UserService.Instance,
  ) {}

  // ── A person's own account

  async requestMine(actor: Actor): Promise<{ scheduledFor: Date }> {
    const membership = await this.members.findMembership(actor.businessId, actor.id);
    if (membership?.role === "owner") {
      throw AppError.conflict("You own this business. To leave, delete the business instead (Settings → Business).");
    }
    const scheduledFor = graceEnd();
    await runInTransaction(async (tx) => {
      await this.users.setDeletionSchedule(actor.id, scheduledFor, tx);
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "account.deletion_requested",
          entityType: "user",
          entityId: actor.id,
          payload: { scheduledFor: scheduledFor.toISOString() },
        },
        tx,
      );
    });
    return { scheduledFor };
  }

  async cancelMine(actor: Actor): Promise<void> {
    await runInTransaction(async (tx) => {
      await this.users.setDeletionSchedule(actor.id, null, tx);
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "account.deletion_cancelled",
          entityType: "user",
          entityId: actor.id,
        },
        tx,
      );
    });
  }

  // ── The whole business (owner only)

  async requestBusiness(actor: Actor, confirmName: string): Promise<{ scheduledFor: Date }> {
    const business = await this.businesses.findBusiness(actor.businessId);
    if (!business) throw AppError.notFound("Business not found");
    if (confirmName.trim().toLowerCase() !== business.name.trim().toLowerCase()) {
      throw AppError.unprocessable("Type the business name exactly to confirm", [
        { field: "confirmName", message: "Does not match" },
      ]);
    }
    const scheduledFor = graceEnd();
    await runInTransaction(async (tx) => {
      await this.businesses.setDeletionSchedule(actor.businessId, scheduledFor, tx);
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "business.deletion_requested",
          entityType: "business",
          entityId: actor.businessId,
          payload: { scheduledFor: scheduledFor.toISOString() },
        },
        tx,
      );
    });
    return { scheduledFor };
  }

  async cancelBusiness(actor: Actor): Promise<void> {
    await runInTransaction(async (tx) => {
      await this.businesses.setDeletionSchedule(actor.businessId, null, tx);
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "business.deletion_cancelled",
          entityType: "business",
          entityId: actor.businessId,
        },
        tx,
      );
    });
  }

  // ── The job

  /**
   * Carries out deletions whose grace period has ended. Each one commits on
   * its own; logins and pictures are removed AFTER the commit, best effort —
   * a failure there is logged, never undoes the anonymising.
   */
  async processDue(): Promise<{ users: number; businesses: number }> {
    const result = { users: 0, businesses: 0 };

    for (const business of await this.deletions.dueBusinesses(ACCOUNT_DELETION.perRun)) {
      const { uids, imagePublicIds } = await runInTransaction(async (tx) => {
        const firebaseUids: string[] = [];
        for (const userId of await this.deletions.businessUserIds(business.id, tx)) {
          const { firebaseUid } = await this.deletions.anonymiseUser(userId, tx);
          if (firebaseUid) firebaseUids.push(firebaseUid);
        }
        const { imagePublicIds: ids } = await this.deletions.anonymiseBusiness(business.id, tx);
        await this.activity.audit(
          {
            businessId: business.id,
            actorId: null,
            action: "business.deleted",
            entityType: "business",
            entityId: business.id,
          },
          tx,
        );
        return { uids: firebaseUids, imagePublicIds: ids };
      });
      this.userService.invalidateBusiness(business.id);
      await this.deleteLogins(uids);
      for (const publicId of imagePublicIds) await this.storage.deleteImage(publicId);
      result.businesses += 1;
    }

    for (const user of await this.deletions.dueUsers(ACCOUNT_DELETION.perRun)) {
      const { firebaseUid } = await runInTransaction(async (tx) => {
        const anonymised = await this.deletions.anonymiseUser(user.id, tx);
        await this.activity.audit(
          {
            businessId: user.businessId,
            actorId: null,
            action: "account.deleted",
            entityType: "user",
            entityId: user.id,
          },
          tx,
        );
        return anonymised;
      });
      this.userService.invalidate(user.id);
      await this.deleteLogins(firebaseUid ? [firebaseUid] : []);
      result.users += 1;
    }
    return result;
  }

  /** Best effort; a login that is already gone is fine. */
  private async deleteLogins(uids: string[]): Promise<void> {
    if (uids.length === 0) return;
    if (!firebaseAdminConfigured()) {
      logger.warn({ count: uids.length }, "Firebase logins not deleted: no service account configured");
      return;
    }
    for (const uid of uids) {
      await firebaseAuth()
        .deleteUser(uid)
        .catch((err: { code?: string }) => {
          if (err?.code !== "auth/user-not-found") logger.warn({ err }, "Firebase login could not be deleted");
        });
    }
  }
}
