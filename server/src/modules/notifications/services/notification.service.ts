import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import type { Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { UserRepository } from "../../users/repositories/user.repository";
import type { NotificationRecord, NotifyInput } from "../dto/notification.dto";
import { defaultChoice } from "../dto/preference.dto";
import { NotificationRepository } from "../repositories/notification.repository";
import { PreferenceRepository } from "../repositories/preference.repository";
import { PushRepository } from "../repositories/push.repository";
import type { ListNotificationsQuery } from "../validators/notification.schema";
import { EmailOutboxService } from "./emailOutbox.service";
import { PushDeliveryService } from "./pushDelivery.service";

export class NotificationService {
  static Instance = new NotificationService();

  private constructor(
    private readonly notifications = NotificationRepository.Instance,
    private readonly preferences = PreferenceRepository.Instance,
    private readonly push = PushRepository.Instance,
    private readonly pushSender = PushDeliveryService.Instance,
    private readonly emails = EmailOutboxService.Instance,
    private readonly users = UserRepository.Instance,
  ) {}

  /**
   * The notification pipeline (Backend Guide §26.1). Call it INSIDE the
   * transaction of the change it reports, passing `tx`, so a rolled-back change
   * never notifies anyone. It:
   *  1. skips people who switched this type off in the app;
   *  2. creates the in-app notifications (a repeated dedupe key is a no-op);
   *  3. queues an email copy for those who want one;
   *  4. queues a push copy for those who want one and have a registered browser.
   * The in-app notification is the source of truth: email and push are copies,
   * and are dropped if it has been read by the time they would go.
   */
  async notify(input: NotifyInput, tx?: Tx): Promise<void> {
    const userIds = [...new Set(input.userIds)];
    if (userIds.length === 0) return;
    const saved = await this.preferences.forUsers(userIds, input.type, tx);
    const choiceOf = (userId: string) => saved.get(userId) ?? defaultChoice(input.type);

    const created = await this.notifications.insertMany(
      userIds
        .filter((userId) => choiceOf(userId).inApp)
        .map((userId) => ({
          businessId: input.businessId,
          userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          linkPath: input.linkPath ?? null,
          dedupeKey: input.dedupeKey ? input.dedupeKey(userId) : null,
        })),
      tx,
    );
    if (created.length === 0) return;

    const wantEmail = created.filter((row) => choiceOf(row.userId).email);
    if (wantEmail.length > 0) {
      const people = await this.users.findUsers(
        wantEmail.map((row) => row.userId),
        tx,
      );
      for (const row of wantEmail) {
        const person = people.get(row.userId);
        if (!person || person.status !== "active") continue;
        await this.emails.queue(
          {
            businessId: input.businessId,
            kind: "notification",
            to: person.email,
            toName: person.fullName,
            payload: { notificationId: row.id },
            dedupeKey: `notification:${row.id}`,
          },
          tx,
        );
      }
    }

    if (this.pushSender.configured) {
      const wantPush = created.filter((row) => choiceOf(row.userId).push);
      const withDevices = await this.push.usersWithDevices(
        wantPush.map((row) => row.userId),
        tx,
      );
      await this.push.enqueue(
        wantPush
          .filter((row) => withDevices.has(row.userId))
          .map((row) => ({ notificationId: row.id, userId: row.userId })),
        tx,
      );
    }
  }

  /** The caller's own notifications, newest first. */
  list(actor: Actor, query: ListNotificationsQuery): Promise<Paginated<NotificationRecord>> {
    return this.notifications.listForUser({ ...query, userId: actor.id, businessId: actor.businessId });
  }

  async unreadCount(actor: Actor): Promise<{ unread: number }> {
    return { unread: await this.notifications.countUnread(actor.id, actor.businessId) };
  }

  /** Someone else's notification is a 404. */
  async markRead(actor: Actor, id: string): Promise<void> {
    if (!(await this.notifications.findForUser(id, actor.id))) throw AppError.notFound("Notification not found");
    await this.notifications.markRead(id, actor.id);
  }

  async markAllRead(actor: Actor): Promise<{ marked: number }> {
    return { marked: await this.notifications.markAllRead(actor.id, actor.businessId) };
  }
}
