import { PUSH } from "../../../config/constants";
import { logger } from "../../../infrastructure/logger/logger";
import { FcmPushProvider, type PushProvider } from "../../../infrastructure/push/pushProvider";
import { UserRepository } from "../../users/repositories/user.repository";
import { isDeadToken, isStale, nextPushRetry, pushBody, pushLink } from "../domain/pushRules";
import { NotificationRepository } from "../repositories/notification.repository";
import { PushRepository } from "../repositories/push.repository";

/**
 * The push sender, run by the `deliverPush` job. A push is a copy of an
 * in-app notification: it is dropped if that was read already, is older than
 * a day, or the person's account is no longer active.
 */
export class PushDeliveryService {
  static Instance = new PushDeliveryService();

  private constructor(
    private readonly push = PushRepository.Instance,
    private readonly notifications = NotificationRepository.Instance,
    private readonly users = UserRepository.Instance,
    private provider: PushProvider = new FcmPushProvider(),
  ) {}

  /** Swap the provider (used by local checks). */
  use(provider: PushProvider): void {
    this.provider = provider;
  }

  get configured(): boolean {
    return this.provider.configured;
  }

  async deliverPending(limit: number = PUSH.maxPerTick): Promise<{ sent: number; failed: number; cancelled: number }> {
    const result = { sent: 0, failed: 0, cancelled: 0 };
    if (!this.provider.configured) return result;

    for (const delivery of await this.push.claimDue(limit)) {
      const now = new Date();
      const cancel = async (reason: string) => {
        await this.push.markCancelled(delivery.id, reason);
        result.cancelled += 1;
      };
      try {
        const notification = await this.notifications.findById(delivery.notificationId);
        if (!notification) {
          await cancel("Notification no longer exists");
          continue;
        }
        if (notification.readAt) {
          await cancel("Already read in the app");
          continue;
        }
        if (isStale(new Date(delivery.createdAt), now)) {
          await cancel("Too old to send");
          continue;
        }
        const user = await this.users.findUser(delivery.userId);
        if (!user || user.status !== "active") {
          await cancel("Account is not active");
          continue;
        }
        const tokens = await this.push.tokensFor(delivery.userId);
        if (tokens.length === 0) {
          await cancel("No registered devices");
          continue;
        }

        const results = await this.provider.send(tokens, {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: pushBody(notification.body),
          link: pushLink(notification.linkPath),
        });
        await this.push.removeTokens(results.filter((r) => isDeadToken(r.error)).map((r) => r.token));

        if (results.some((r) => r.ok)) {
          await this.push.markSent(delivery.id);
          result.sent += 1;
        } else if (results.every((r) => isDeadToken(r.error))) {
          await cancel("Every device has gone");
        } else {
          throw new Error(results.map((r) => r.error ?? "unknown").join(", "));
        }
      } catch (err) {
        // Other errors — including a credentials problem — are retried and reported, never wipe devices.
        const message = err instanceof Error ? err.message : String(err);
        const retryAt = nextPushRetry(delivery.attempts, now);
        await this.push.markAttemptFailed(delivery.id, message, retryAt);
        logger.warn({ deliveryId: delivery.id, attempts: delivery.attempts + 1, err }, "push not sent");
        if (!retryAt) result.failed += 1;
      }
    }
    return result;
  }

  pruneStaleDevices(): Promise<number> {
    return this.push.pruneStale();
  }
}
