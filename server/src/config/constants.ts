/** Product constants live here, not as scattered literals (Backend Guide §29.1). */

export const SERVICE_NAME = "tailorflow-api";

export const PAGINATION = { defaultLimit: 20, maxLimit: 100 } as const;

/** How long a resolved auth user (roles included) is cached per Firebase uid. */
export const AUTH_CACHE_TTL_MS = 60_000;

export const DEFAULT_TIME_ZONE = "Africa/Lagos";
export const DEFAULT_CURRENCY = "NGN";

export const SHUTDOWN_DRAIN_MS = 10_000;

/** How long a stored Idempotency-Key response can be replayed. */
export const IDEMPOTENCY_TTL_HOURS = 24;

/** Background jobs (Backend Guide §25). */
export const JOBS = {
  /** In-process scheduler: first run after boot, then every tick. */
  firstRunMs: 15_000,
  tickMs: 60_000,
  /** Clean-ups run this often, not every tick. */
  purgeEveryMs: 3_600_000,
  /** Reminders sent per run. */
  reminderBatch: 200,
} as const;

/** Uploads (Backend Guide §20). */
export const UPLOAD_LIMITS = {
  imageMb: 5,
  /** Images in one request. */
  filesPerRequest: 5,
  /** Live images on one order or one design. */
  imagesPerItem: 12,
  /** Longest side after resizing. */
  maxDimension: 1600,
} as const;

/** The email outbox (Backend Guide §22, §26.1). */
export const EMAIL = {
  maxAttempts: 5,
  /** Sends per job run. */
  perTick: 50,
  /** Rows older than this are cancelled, not sent late. */
  maxAgeHours: 24,
  /** Receipts carry the PDF and stay useful longer. */
  receiptMaxAgeHours: 24 * 14,
} as const;

/** Web push (FCM). */
export const PUSH = {
  maxPerTick: 100,
  /** Pushes older than this are dropped, not sent late. */
  maxAgeHours: 24,
  maxAttempts: 5,
  maxDevicesPerUser: 10,
  /** Browsers not seen for this long are forgotten. */
  staleDeviceDays: 60,
  bodyMax: 180,
} as const;

/** Deleting an account or a business (Backend Guide §27.5). */
export const ACCOUNT_DELETION = {
  /** Days to change one's mind; everything keeps working until then. */
  graceDays: 7,
  /** Accounts and businesses processed per job run. */
  perRun: 20,
} as const;

/** Exports (PRD US-053). */
export const EXPORT = { pageSize: 100, maxRows: 20_000 } as const;

/** Public pages: the customer portal and the booking page. */
export const PUBLIC = {
  /** Appointment requests a phone number may have waiting at one business. */
  maxPendingRequestsPerPhone: 3,
  /** How far ahead a customer may ask for. */
  maxRequestDaysAhead: 180,
} as const;

/** One Postgres advisory-lock id per job. Unique; never reuse a number. */
export const JOB_LOCK_IDS = {
  sendAppointmentReminders: 710_001,
  purgeIdempotencyKeys: 710_002,
  deliverEmails: 710_003,
  deliverPush: 710_004,
  pruneDevices: 710_005,
  processAccountDeletions: 710_006,
} as const;
