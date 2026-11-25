/** One day of platform figures (UTC), from `platform_daily_stats`. */
export interface DailyStatDTO {
  day: string;
  businessesTotal: number;
  businessesNew: number;
  businessesActive7d: number;
  peopleNew: number;
  peopleActive7d: number;
  ordersNew: number;
  appointmentsNew: number;
  paymentsNew: number;
  emailsSent: number;
  emailsFailed: number;
}

/** Of the businesses active in the period, how many used each feature in it. */
export interface AdoptionDTO {
  days: number;
  activeBusinesses: number;
  features: { key: string; label: string; businesses: number }[];
}

/**
 * Businesses grouped by the week they signed up. `activated` = took a first order within 14 days.
 * Each retention point counts only businesses old enough to have reached it (`eligible`).
 */
export interface CohortDTO {
  weekStart: string;
  size: number;
  activated: number;
  retention: { week: number; eligible: number; retained: number }[];
}

export interface AdminNoteDTO {
  id: string;
  createdAt: Date;
  body: string;
  author: { id: string; fullName: string } | null;
}

/** A business and how likely it is to stop using the platform, with the reasons. */
export interface ChurnRiskDTO {
  businessId: string;
  name: string;
  ownerEmail: string | null;
  createdAt: Date;
  daysSinceActivity: number | null;
  score: number;
  level: "high" | "medium" | "low";
  reasons: string[];
}

export const ADMIN_REPORTS = [
  "churn-risk",
  "businesses",
  "people",
  "admin-actions",
  "alerts",
  "daily-stats",
  "adoption",
  "cohorts",
] as const;
export type AdminReportKind = (typeof ADMIN_REPORTS)[number];
