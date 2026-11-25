import { ANNOUNCEMENTS } from "../../../config/constants";
import { AppError } from "../../../shared/errors/AppError";
import { runInTransaction } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { ActivityService } from "../../activity/services/activity.service";
import { NotificationService } from "../../notifications/services/notification.service";
import type { AnnouncementDTO, NewAnnouncementInput } from "../dto/announcement.dto";
import { AnnouncementRepository } from "../repositories/announcement.repository";

/**
 * Messages from Tailor Seamless to the businesses on it. Sending is never done in the request: the
 * announcement is queued, and the `deliverAnnouncements` job notifies a batch of businesses per run
 * through the ordinary notification pipeline (so people's choices for in-app, push and email apply).
 */
export class AnnouncementService {
  static Instance = new AnnouncementService();

  private constructor(
    private readonly announcements = AnnouncementRepository.Instance,
    private readonly notifications = NotificationService.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  list(): Promise<AnnouncementDTO[]> {
    return this.announcements.list();
  }

  async create(actor: Actor, input: NewAnnouncementInput): Promise<AnnouncementDTO[]> {
    await runInTransaction(async (tx) => {
      const id = await this.announcements.create(actor.id, input, tx);
      await this.activity.audit(
        {
          businessId: null,
          actorId: actor.id,
          action: "admin.announcement_created",
          entityType: "platform_announcement",
          entityId: id,
          payload: { audience: input.audience, title: input.title },
        },
        tx,
      );
    });
    return this.announcements.list();
  }

  /** Stops one still being delivered; businesses already reached keep their notification. */
  async cancel(actor: Actor, id: string): Promise<AnnouncementDTO[]> {
    await runInTransaction(async (tx) => {
      const status = await this.announcements.findStatus(id, tx);
      if (!status) throw AppError.notFound("Announcement not found");
      if (status === "sent" || status === "cancelled")
        throw AppError.conflict(`This announcement is already ${status}`);
      await this.announcements.cancel(id, tx);
      await this.activity.audit(
        {
          businessId: null,
          actorId: actor.id,
          action: "admin.announcement_cancelled",
          entityType: "platform_announcement",
          entityId: id,
        },
        tx,
      );
    });
    return this.announcements.list();
  }

  /**
   * The job: one batch of businesses for the oldest unfinished announcement. Each batch commits with
   * its cursor, and every notification carries a dedupe key, so a crash or a second run never sends
   * twice. Returns what it did.
   */
  async deliverNext(): Promise<{ announcement: string | null; businesses: number; recipients: number; done: boolean }> {
    return runInTransaction(async (tx) => {
      const work = await this.announcements.claimNext(tx);
      if (!work) return { announcement: null, businesses: 0, recipients: 0, done: true };
      const batch = await this.announcements.nextBatch(
        work.cursorBusinessId,
        work.audience,
        ANNOUNCEMENTS.businessesPerRun,
        tx,
      );
      let recipients = 0;
      for (const business of batch) {
        if (business.userIds.length === 0) continue;
        await this.notifications.notify(
          {
            businessId: business.businessId,
            userIds: business.userIds,
            type: "platform.announcement",
            title: work.title,
            body: work.body,
            linkPath: work.linkPath,
            dedupeKey: (userId) => `announcement:${work.id}:${userId}`,
          },
          tx,
        );
        recipients += business.userIds.length;
      }
      const last = batch.at(-1);
      if (last) await this.announcements.advance(work.id, last.businessId, batch.length, recipients, tx);
      const done = batch.length < ANNOUNCEMENTS.businessesPerRun;
      if (done) await this.announcements.finish(work.id, tx);
      return { announcement: work.id, businesses: batch.length, recipients, done };
    });
  }
}
