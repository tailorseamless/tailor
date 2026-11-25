export const ALERT_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = ["open", "acknowledged", "resolved"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

/** What a rule found: raised as a new alert, or counted on the open one with the same key. */
export interface AlertCandidate {
  type: string;
  severity: AlertSeverity;
  title: string;
  detail?: string | null;
  businessId?: string | null;
  data?: Record<string, unknown>;
  dedupeKey: string;
}

export interface AdminAlertDTO {
  id: string;
  createdAt: Date;
  type: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  detail: string | null;
  business: { id: string; name: string } | null;
  data: Record<string, unknown>;
  occurrences: number;
  lastSeenAt: Date;
  acknowledged: { by: string | null; at: Date } | null;
  /** `by` null = it cleared by itself. */
  resolved: { by: string | null; at: Date; note: string | null } | null;
}

/** Open (not yet resolved) alerts, by severity: the Overview's "needs attention". */
export type OpenAlertCounts = Record<AlertSeverity, number>;

export interface ListAlertsParams {
  page: number;
  limit: number;
  /** `active` = open or acknowledged. */
  status?: AlertStatus | "active";
  severity?: AlertSeverity;
}
