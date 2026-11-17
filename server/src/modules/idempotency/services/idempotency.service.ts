import { IDEMPOTENCY_TTL_HOURS } from "../../../config/constants";
import { IdempotencyRepository, type StoredKey } from "../repositories/idempotency.repository";

export type Reservation = { reservedId: string } | { existing: StoredKey | null };

export class IdempotencyService {
  static Instance = new IdempotencyService();

  private constructor(private readonly keys = IdempotencyRepository.Instance) {}

  /** Claims the key for this request, or returns what an earlier request left under it. */
  async begin(userId: string, key: string, requestHash: string): Promise<Reservation> {
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 3_600_000);
    const reservedId = await this.keys.reserve(userId, key, requestHash, expiresAt);
    if (reservedId) return { reservedId };
    return { existing: await this.keys.findKey(userId, key) };
  }

  complete(id: string, statusCode: number, response: unknown): Promise<void> {
    return this.keys.complete(id, statusCode, response);
  }

  release(id: string): Promise<void> {
    return this.keys.release(id);
  }

  /** The clean-up job's work; safe to run any number of times. */
  async purgeExpired(): Promise<{ removed: number }> {
    return { removed: await this.keys.purgeExpired() };
  }
}
