import type { CloudinaryUsage } from "../../../infrastructure/storage/cloudinaryProvider";

export type JobOutcome = "succeeded" | "failed";

export interface JobStatusDTO {
  name: string;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastOutcome: JobOutcome | null;
  lastSucceededAt: Date | null;
  lastFailedAt: Date | null;
  consecutiveFailures: number;
  lastDurationMs: number | null;
  lastResult: unknown;
  /** Only for `admin.technical`; null otherwise. */
  lastError: string | null;
}

/** How deliveries (email or push) went over the last 24 hours, and what is still waiting. */
export interface DeliveryHealthDTO {
  last24h: { sent: number; failed: number; cancelled: number };
  pending: number;
  /** When the oldest waiting message was queued; null when nothing waits. */
  oldestPendingAt: Date | null;
}

/** The latest failed emails: kind and error only, never the address (`admin.technical`). */
export interface FailedEmailDTO {
  id: string;
  kind: string;
  attempts: number;
  lastError: string | null;
  updatedAt: Date;
}

/** GET /admin/system-health — is the application healthy? */
export interface SystemHealthDTO {
  checkedAt: Date;
  api: { uptimeSeconds: number; nodeVersion: string; environment: string };
  database: { ok: boolean; pendingMigrations: boolean | null };
  jobs: { inProcess: boolean; list: JobStatusDTO[] };
  email: DeliveryHealthDTO & { enabled: boolean; recentFailures: FailedEmailDTO[] };
  push: DeliveryHealthDTO & { enabled: boolean };
  /** Errors themselves live in Sentry; this says whether it is set up. */
  errorMonitoring: { enabled: boolean };
  /** Image storage plan usage (Cloudinary); null when not set up or not reachable. */
  storage: (CloudinaryUsage & { checkedAt: Date }) | null;
  /** The tables that grow without bound: estimated rows and size on disk. */
  tables: { name: string; rows: number; bytes: number }[];
  /** Requests turned away for security reasons in the last 24 hours. */
  security: {
    last24h: Record<string, number>;
    /** Only for `admin.technical`: which addresses, how many. Empty otherwise. */
    topSources: { kind: string; ip: string; count: number; lastAt: Date }[];
  };
}
