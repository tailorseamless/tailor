import { In, LessThan, type Repository } from "typeorm";
import { PUSH } from "../../../config/constants";
import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { returnedRows } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import { DeviceToken } from "../entities/deviceToken.entity";
import { PushDelivery } from "../entities/pushDelivery.entity";

export interface DueDelivery {
  id: string;
  notificationId: string;
  userId: string;
  attempts: number;
  createdAt: Date;
}

const LEASE_MINUTES = 5;

/** Registered browsers and the push queue. */
export class PushRepository {
  static Instance = new PushRepository();

  private constructor() {}

  private devices(tx?: Tx): Repository<DeviceToken> {
    return (tx ?? AppDataSource.manager).getRepository(DeviceToken);
  }

  private deliveries(tx?: Tx): Repository<PushDelivery> {
    return (tx ?? AppDataSource.manager).getRepository(PushDelivery);
  }

  /**
   * Registers a browser for this person. A token already known moves to them
   * (one browser, one owner). Keeps at most PUSH.maxDevicesPerUser per person.
   */
  async register(userId: string, businessId: string, token: string, userAgent: string | null): Promise<void> {
    await this.devices()
      .createQueryBuilder()
      .insert()
      .values({ userId, businessId, token, userAgent, lastSeenAt: () => "now()" })
      .orUpdate(["user_id", "business_id", "user_agent", "last_seen_at"], ["token"])
      .execute();
    await this.devices().query(
      `DELETE FROM device_tokens
        WHERE user_id = $1
          AND id NOT IN (SELECT id FROM device_tokens WHERE user_id = $1 ORDER BY last_seen_at DESC LIMIT $2)`,
      [userId, PUSH.maxDevicesPerUser],
    );
  }

  async unregister(userId: string, token: string): Promise<boolean> {
    const result = await this.devices().delete({ userId, token });
    return (result.affected ?? 0) > 0;
  }

  /** Index: device_tokens(user_id, last_seen_at). */
  countForUser(userId: string): Promise<number> {
    return this.devices().count({ where: { userId } });
  }

  async usersWithDevices(userIds: string[], tx?: Tx): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await this.devices(tx)
      .createQueryBuilder("d")
      .select("DISTINCT d.user_id", "userId")
      .where("d.user_id IN (:...userIds)", { userIds })
      .getRawMany<{ userId: string }>();
    return new Set(rows.map((row) => row.userId));
  }

  async tokensFor(userId: string): Promise<string[]> {
    const rows = await this.devices()
      .createQueryBuilder("d")
      .select("d.token", "token")
      .where("d.user_id = :userId", { userId })
      .orderBy("d.last_seen_at", "DESC")
      .limit(PUSH.maxDevicesPerUser)
      .getRawMany<{ token: string }>();
    return rows.map((row) => row.token);
  }

  /** Tokens FCM says are dead — never ones that failed for other reasons. */
  async removeTokens(tokens: string[]): Promise<void> {
    if (tokens.length > 0) await this.devices().delete({ token: In(tokens) });
  }

  /** Browsers not seen for PUSH.staleDeviceDays. Index: device_tokens(last_seen_at). */
  async pruneStale(): Promise<number> {
    const cutoff = new Date(Date.now() - PUSH.staleDeviceDays * 86_400_000);
    const result = await this.devices().delete({ lastSeenAt: LessThan(cutoff) });
    return result.affected ?? 0;
  }

  async removeAllFor(userId: string, tx?: Tx): Promise<void> {
    await this.devices(tx).delete({ userId });
  }

  // ── The queue

  async enqueue(rows: { notificationId: string; userId: string }[], tx?: Tx): Promise<void> {
    if (rows.length === 0) return;
    await this.deliveries(tx).createQueryBuilder().insert().values(rows).orIgnore().execute();
  }

  /** Claims due rows with a short lease, in one statement (SKIP LOCKED). Index: IDX_push_deliveries_due. */
  async claimDue(limit: number): Promise<DueDelivery[]> {
    const result: unknown = await this.deliveries().query(
      `UPDATE push_deliveries
          SET next_attempt_at = now() + interval '${LEASE_MINUTES} minutes', updated_at = now()
        WHERE id IN (SELECT id FROM push_deliveries
                      WHERE status = 'pending' AND next_attempt_at <= now()
                      ORDER BY next_attempt_at
                      LIMIT $1
                        FOR UPDATE SKIP LOCKED)
    RETURNING id, notification_id AS "notificationId", user_id AS "userId", attempts, created_at AS "createdAt"`,
      [limit],
    );
    return returnedRows<DueDelivery>(result);
  }

  async markSent(id: string): Promise<void> {
    await this.deliveries().update(id, { status: "sent", sentAt: new Date(), attempts: () => "attempts + 1" });
  }

  async markCancelled(id: string, reason: string): Promise<void> {
    await this.deliveries().update(id, { status: "cancelled", lastError: reason });
  }

  async markAttemptFailed(id: string, error: string, retryAt: Date | null): Promise<void> {
    await this.deliveries().update(id, {
      attempts: () => "attempts + 1",
      lastError: error.slice(0, 1000),
      ...(retryAt ? { nextAttemptAt: retryAt } : { status: "failed" as const }),
    });
  }
}
