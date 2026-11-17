import { In, type Repository } from "typeorm";
import { AppDataSource } from "../../../infrastructure/database/dataSource";
import type { Tx } from "../../../shared/repositories/transaction";
import type { NotificationType } from "../dto/notification.dto";
import type { ChannelChoice } from "../dto/preference.dto";
import { NotificationPreference } from "../entities/notificationPreference.entity";

export class PreferenceRepository {
  static Instance = new PreferenceRepository();

  private constructor() {}

  private repo(tx?: Tx): Repository<NotificationPreference> {
    return (tx ?? AppDataSource.manager).getRepository(NotificationPreference);
  }

  /** Saved choices of several people for one type. Index: UQ_notification_preferences_user_type. */
  async forUsers(userIds: string[], type: NotificationType, tx?: Tx): Promise<Map<string, ChannelChoice>> {
    const choices = new Map<string, ChannelChoice>();
    if (userIds.length === 0) return choices;
    const rows = await this.repo(tx).find({ where: { userId: In(userIds), type } });
    for (const row of rows) choices.set(row.userId, { inApp: row.inApp, email: row.email, push: row.push });
    return choices;
  }

  /** All of one person's saved choices (one row per type at most). */
  async forUser(userId: string): Promise<Map<string, ChannelChoice>> {
    const rows = await this.repo().find({ where: { userId }, take: 100 });
    return new Map(rows.map((row) => [row.type, { inApp: row.inApp, email: row.email, push: row.push }]));
  }

  async save(userId: string, choices: (ChannelChoice & { type: NotificationType })[], tx?: Tx): Promise<void> {
    if (choices.length === 0) return;
    await this.repo(tx)
      .createQueryBuilder()
      .insert()
      .values(choices.map((choice) => ({ userId, ...choice })))
      .orUpdate(["in_app", "email", "push", "updated_at"], ["user_id", "type"])
      .execute();
  }
}
