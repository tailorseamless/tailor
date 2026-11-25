import { ALERTS, SECURITY } from "../../../config/constants";
import { SecurityCounterRepository } from "../../system/repositories/securityCounter.repository";
import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { ONBOARDING_STEPS } from "../../users/dto/user.dto";
import type { AlertCandidate } from "../dto/alert.dto";

const toInt = (value: unknown) => Number(value ?? 0);

/** Businesses the rules look at: live and not suspended (a suspended one is already being dealt with). */
const LIVE_BUSINESS = `b.deleted_at IS NULL AND b.status = 'active'`;

/**
 * The questions the alert rules ask the database. Each returns what it found as alert candidates;
 * the service decides what to raise and what has cleared. Counts and ids only.
 */
export class AlertRulesRepository {
  static Instance = new AlertRulesRepository();

  private constructor() {}

  /** A background job failing run after run. */
  async failingJobs(): Promise<AlertCandidate[]> {
    const rows: { name: string; failures: number }[] = await AppDataSource.query(
      `SELECT name, consecutive_failures AS failures FROM job_status WHERE consecutive_failures >= $1`,
      [ALERTS.jobFailuresInRow],
    );
    return rows.map((row) => ({
      type: "job_failing",
      severity: "critical",
      title: `The ${row.name} job keeps failing`,
      detail: `${row.failures} runs in a row have failed. See System health.`,
      data: { job: row.name, failures: row.failures },
      dedupeKey: `job_failing:${row.name}`,
    }));
  }

  /** Email failing for a noticeable share of attempts in the last 24 hours. */
  async emailFailureRate(): Promise<AlertCandidate[]> {
    const [row] = await AppDataSource.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'sent') AS sent, COUNT(*) FILTER (WHERE status = 'failed') AS failed
         FROM email_outbox WHERE updated_at > now() - interval '24 hours'`,
    );
    const sent = toInt(row.sent);
    const failed = toInt(row.failed);
    const attempts = sent + failed;
    if (attempts < ALERTS.emailMinAttempts || failed / attempts <= ALERTS.emailFailureRate) return [];
    return [
      {
        type: "email_failure_rate",
        severity: "medium",
        title: "Emails are failing",
        detail: `${failed} of ${attempts} emails in the last 24 hours could not be sent.`,
        data: { sent, failed },
        dedupeKey: "email_failure_rate",
      },
    ];
  }

  /** Every business waiting to be deleted: a chance to understand why, or to help. */
  async businessDeletions(): Promise<AlertCandidate[]> {
    const rows: { id: string; name: string; due: string }[] = await AppDataSource.query(
      `SELECT b.id, b.name, to_char(b.deletion_scheduled_for, 'YYYY-MM-DD') AS due
         FROM businesses b WHERE b.deletion_scheduled_for IS NOT NULL AND b.deleted_at IS NULL`,
    );
    return rows.map((row) => ({
      type: "business_deletion",
      severity: "high",
      title: `${row.name} asked to delete their business`,
      detail: `It will be anonymised on ${row.due} unless the owner cancels.`,
      businessId: row.id,
      data: { due: row.due },
      dedupeKey: `business_deletion:${row.id}:${row.due}`,
    }));
  }

  /** Someone became, or stopped being, a business's owner in the last day. */
  async ownerChanges(): Promise<AlertCandidate[]> {
    const rows: { id: string; businessId: string; name: string; userId: string; from: string; to: string }[] =
      await AppDataSource.query(
        `SELECT a.id, a.business_id AS "businessId", b.name, a.entity_id AS "userId",
                a.payload->>'roleFrom' AS "from", a.payload->>'roleTo' AS "to"
           FROM audit_logs a JOIN businesses b ON b.id = a.business_id
          WHERE a.action = 'team.member_updated' AND a.created_at > now() - interval '1 day'
            AND (a.payload->>'roleTo' = 'owner' OR a.payload->>'roleFrom' = 'owner')`,
      );
    return rows.map((row) => ({
      type: "owner_change",
      severity: "high",
      title: `Ownership changed in ${row.name}`,
      detail: `A member went from ${row.from} to ${row.to}.`,
      businessId: row.businessId,
      data: { auditId: row.id, userId: row.userId, from: row.from, to: row.to },
      dedupeKey: `owner_change:${row.id}`,
    }));
  }

  /** Many voids and refunds in one business today: a mistake, misuse or fraud worth a look. */
  async paymentReversals(): Promise<AlertCandidate[]> {
    const rows: { businessId: string; name: string; reversals: string; day: string }[] = await AppDataSource.query(
      `SELECT a.business_id AS "businessId", b.name, COUNT(*) AS reversals, to_char(now(), 'YYYY-MM-DD') AS day
         FROM audit_logs a JOIN businesses b ON b.id = a.business_id
        WHERE a.action IN ('payment.voided', 'payment.refunded') AND a.created_at > now() - interval '24 hours'
          AND ${LIVE_BUSINESS}
        GROUP BY a.business_id, b.name HAVING COUNT(*) >= $1`,
      [ALERTS.paymentReversalsPerDay],
    );
    return rows.map((row) => ({
      type: "payment_reversals",
      severity: "high",
      title: `Unusual voids and refunds in ${row.name}`,
      detail: `${toInt(row.reversals)} payments voided or refunded in the last 24 hours.`,
      businessId: row.businessId,
      data: { reversals: toInt(row.reversals) },
      dedupeKey: `payment_reversals:${row.businessId}:${row.day}`,
    }));
  }

  /** Appointment requests from customers that nobody has answered. */
  async pendingRequests(): Promise<AlertCandidate[]> {
    const rows: { businessId: string; name: string; waiting: string }[] = await AppDataSource.query(
      `SELECT r.business_id AS "businessId", b.name, COUNT(*) AS waiting
         FROM appointment_requests r JOIN businesses b ON b.id = r.business_id
        WHERE r.status = 'pending' AND r.deleted_at IS NULL AND ${LIVE_BUSINESS}
          AND r.created_at < now() - make_interval(hours => $1)
        GROUP BY r.business_id, b.name`,
      [ALERTS.requestPendingHours],
    );
    return rows.map((row) => ({
      type: "requests_pending",
      severity: "medium",
      title: `${row.name} has unanswered appointment requests`,
      detail: `${toInt(row.waiting)} waiting longer than ${ALERTS.requestPendingHours} hours.`,
      businessId: row.businessId,
      data: { waiting: toInt(row.waiting) },
      dedupeKey: `requests_pending:${row.businessId}`,
    }));
  }

  /** People invited to a team who never signed in. */
  async pendingInvites(): Promise<AlertCandidate[]> {
    const rows: { businessId: string; name: string; waiting: string }[] = await AppDataSource.query(
      `SELECT u.business_id AS "businessId", b.name, COUNT(*) AS waiting
         FROM users u JOIN businesses b ON b.id = u.business_id
        WHERE u.firebase_uid IS NULL AND u.deleted_at IS NULL AND u.status = 'active' AND ${LIVE_BUSINESS}
          AND u.created_at < now() - make_interval(days => $1)
        GROUP BY u.business_id, b.name`,
      [ALERTS.invitePendingDays],
    );
    return rows.map((row) => ({
      type: "invites_pending",
      severity: "low",
      title: `${row.name} has invitations nobody accepted`,
      detail: `${toInt(row.waiting)} people invited over ${ALERTS.invitePendingDays} days ago have never signed in.`,
      businessId: row.businessId,
      data: { waiting: toInt(row.waiting) },
      dedupeKey: `invites_pending:${row.businessId}`,
    }));
  }

  /**
   * One address turned away again and again within the hour: password guessing, a broken client, or
   * someone guessing portal links. The address is in the dedupe key only (never shown to support);
   * technical admins see it under System health.
   */
  async securityBursts(): Promise<AlertCandidate[]> {
    const bursts = await SecurityCounterRepository.Instance.bursts(SECURITY.burstPerHour);
    const hour = new Date().toISOString().slice(0, 13);
    const what: Record<string, string> = {
      auth_failed: "sign-in tokens that failed to verify",
      disabled_access: "attempts to use disabled or unlinked accounts",
      forbidden: "requests for things the person's role doesn't allow",
      rate_limited: "requests refused for coming too fast",
      portal_token_invalid: "customer-portal links that don't exist",
    };
    return bursts.map((burst) => ({
      type: "security_burst",
      severity: "high",
      title: "Unusual number of refused requests from one address",
      detail: `${burst.count} ${what[burst.kind] ?? burst.kind} in the last hour. The address is under System health.`,
      data: { kind: burst.kind, count: burst.count },
      dedupeKey: `security_burst:${burst.kind}:${burst.ip}:${hour}`,
    }));
  }

  /** New owners who started the getting-started guide and stalled. */
  async stuckOnboarding(): Promise<AlertCandidate[]> {
    const rows: { businessId: string; name: string; done: number }[] = await AppDataSource.query(
      `SELECT b.id AS "businessId", b.name, jsonb_array_length(COALESCE(u.onboarding->'completed', '[]'::jsonb)) AS done
         FROM businesses b
         JOIN business_members m ON m.business_id = b.id AND m.role = 'owner' AND m.deleted_at IS NULL
         JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
        WHERE ${LIVE_BUSINESS} AND u.onboarding IS NOT NULL
          AND COALESCE((u.onboarding->>'dismissed')::boolean, false) = false
          AND jsonb_array_length(COALESCE(u.onboarding->'completed', '[]'::jsonb)) < $3
          AND b.created_at < now() - make_interval(days => $1)
          AND b.created_at > now() - make_interval(days => $2)`,
      [ALERTS.onboardingStuckDays, ALERTS.onboardingWindowDays, ONBOARDING_STEPS.length],
    );
    return rows.map((row) => ({
      type: "onboarding_stuck",
      severity: "low",
      title: `${row.name} is stuck getting started`,
      detail: `The owner has finished ${row.done} of ${ONBOARDING_STEPS.length} setup steps after ${ALERTS.onboardingStuckDays}+ days.`,
      businessId: row.businessId,
      data: { done: row.done },
      dedupeKey: `onboarding_stuck:${row.businessId}`,
    }));
  }
}
