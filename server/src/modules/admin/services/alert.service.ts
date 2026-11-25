import { env } from "../../../config/env";
import { logger } from "../../../infrastructure/logger/logger";
import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { ActivityService } from "../../activity/services/activity.service";
import { EmailOutboxService } from "../../notifications/services/emailOutbox.service";
import { AdminRepository } from "../repositories/admin.repository";
import type { AdminAlertDTO, AlertCandidate, ListAlertsParams, OpenAlertCounts } from "../dto/alert.dto";
import { AlertRepository } from "../repositories/alert.repository";
import { AlertRulesRepository } from "../repositories/alertRules.repository";

interface Rule {
  find: () => Promise<AlertCandidate[]>;
  /**
   * The type to close by itself when the condition is gone. Set for rules that describe a STATE
   * (a job failing, requests waiting); left out for EVENTS (an owner change happened), which a
   * person resolves.
   */
  clears?: string;
}

/**
 * The platform admin's alerts: what needs attention, with severity and a resolution trail.
 * `evaluate` is the job; the rest is the Alerts tab.
 */
export class AlertService {
  static Instance = new AlertService();

  private constructor(
    private readonly alerts = AlertRepository.Instance,
    private readonly rules = AlertRulesRepository.Instance,
    private readonly activity = ActivityService.Instance,
    private readonly adminRows = AdminRepository.Instance,
    private readonly outbox = EmailOutboxService.Instance,
  ) {}

  private ruleList(): Rule[] {
    return [
      { find: () => this.rules.failingJobs(), clears: "job_failing" },
      { find: () => this.rules.emailFailureRate(), clears: "email_failure_rate" },
      { find: () => this.rules.businessDeletions(), clears: "business_deletion" },
      { find: () => this.rules.ownerChanges() },
      { find: () => this.rules.anomalies() },
      { find: () => this.rules.pendingRequests(), clears: "requests_pending" },
      { find: () => this.rules.pendingInvites(), clears: "invites_pending" },
      { find: () => this.rules.stuckOnboarding(), clears: "onboarding_stuck" },
      { find: () => this.rules.securityBursts() },
      { find: () => this.rules.storageNearlyFull(), clears: "storage_credits" },
      { find: () => this.rules.auditLogSize(), clears: "audit_log_size" },
    ];
  }

  /** Runs every rule. Safe to run twice: an open alert is counted, never duplicated. One bad rule never stops the rest. */
  async evaluate(): Promise<{ raised: number; seenAgain: number; cleared: number; failedRules: number }> {
    const result = { raised: 0, seenAgain: 0, cleared: 0, failedRules: 0 };
    for (const rule of this.ruleList()) {
      try {
        const found = await rule.find();
        for (const candidate of found) {
          const { id, inserted } = await this.alerts.raise(candidate);
          if (!inserted) {
            result.seenAgain += 1;
            continue;
          }
          result.raised += 1;
          if (candidate.severity === "critical") await this.emailAdmins(id);
        }
        if (rule.clears) {
          result.cleared += await this.alerts.resolveCleared(
            rule.clears,
            found.map((c) => c.dedupeKey),
          );
        }
      } catch (err) {
        result.failedRules += 1;
        logger.error({ err, rule: rule.clears ?? "event rule" }, "alert rule failed");
      }
    }
    return result;
  }

  /**
   * A new CRITICAL alert is emailed to every active super admin (database grants and
   * PLATFORM_ADMIN_EMAILS). Lower severities wait in the Alerts tab. The email says only what the
   * alert says, and is not sent if the alert is resolved before the delivery job runs.
   */
  private async emailAdmins(alertId: string): Promise<void> {
    try {
      const admins = await this.adminRows.listPlatformAdmins([...env.platformAdmins]);
      const recipients = admins.filter((a) => a.role === "super_admin" && a.user?.status !== "disabled");
      for (const admin of recipients) {
        await this.outbox.queue({
          businessId: null,
          kind: "admin.alert",
          to: admin.email,
          toName: admin.user?.fullName ?? null,
          payload: { alertId },
          dedupeKey: `admin.alert:${alertId}:${admin.email}`,
        });
      }
    } catch (err) {
      logger.error({ err, alertId }, "critical alert email not queued");
    }
  }

  list(params: ListAlertsParams): Promise<Paginated<AdminAlertDTO>> {
    return this.alerts.list(params);
  }

  openCounts(): Promise<OpenAlertCounts> {
    return this.alerts.openCounts();
  }

  /** "I've seen it and I'm on it." */
  async acknowledge(actor: Actor, id: string): Promise<AdminAlertDTO> {
    await runInTransaction(async (tx) => {
      const alert = await this.alerts.lockForChange(id, tx);
      if (!alert) throw AppError.notFound("Alert not found");
      if (alert.status !== "open") throw AppError.conflict(`This alert is already ${alert.status}`);
      await this.alerts.acknowledge(id, actor.id, tx);
      await this.activity.audit(
        {
          businessId: alert.businessId,
          actorId: actor.id,
          action: "admin.alert_acknowledged",
          entityType: "admin_alert",
          entityId: id,
        },
        tx,
      );
    });
    return this.get(id);
  }

  /** Closes it, with what was done about it. */
  async resolve(actor: Actor, id: string, note: string | null): Promise<AdminAlertDTO> {
    await runInTransaction(async (tx) => {
      const alert = await this.alerts.lockForChange(id, tx);
      if (!alert) throw AppError.notFound("Alert not found");
      if (alert.status === "resolved") throw AppError.conflict("This alert is already resolved");
      await this.alerts.resolve(id, actor.id, note, tx);
      await this.activity.audit(
        {
          businessId: alert.businessId,
          actorId: actor.id,
          action: "admin.alert_resolved",
          entityType: "admin_alert",
          entityId: id,
          payload: { note },
        },
        tx,
      );
    });
    return this.get(id);
  }

  private async get(id: string): Promise<AdminAlertDTO> {
    const alert = await this.alerts.find(id);
    if (!alert) throw AppError.notFound("Alert not found");
    return alert;
  }
}
