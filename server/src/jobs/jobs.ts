import { JOB_LOCK_IDS, JOBS, SECURITY } from "../config/constants";
import { AccountDeletionService } from "../modules/accounts/services/accountDeletion.service";
import { AlertService } from "../modules/admin/services/alert.service";
import { AnnouncementService } from "../modules/admin/services/announcement.service";
import { InsightsService } from "../modules/admin/services/insights.service";
import { SecurityCounterRepository } from "../modules/system/repositories/securityCounter.repository";
import { AppointmentService } from "../modules/appointments/services/appointment.service";
import { EmailDeliveryService } from "../modules/notifications/services/emailDelivery.service";
import { PushDeliveryService } from "../modules/notifications/services/pushDelivery.service";
import { IdempotencyService } from "../modules/idempotency/services/idempotency.service";
import { withJobLock } from "./jobLock";

/**
 * The job list (Backend Guide §25). Every job is idempotent and runs under
 * its own advisory lock. To add one: put the work in a service method that is
 * safe to run twice, give it an id in JOB_LOCK_IDS, wrap it here, call it
 * from runTick.
 */
export const sendAppointmentReminders = () =>
  withJobLock("sendAppointmentReminders", JOB_LOCK_IDS.sendAppointmentReminders, () =>
    AppointmentService.Instance.sendDueReminders(),
  );

export const purgeIdempotencyKeys = () =>
  withJobLock("purgeIdempotencyKeys", JOB_LOCK_IDS.purgeIdempotencyKeys, () =>
    IdempotencyService.Instance.purgeExpired(),
  );

/** Runs AFTER the jobs that queue email, so this tick's reminders go out this tick. */
export const deliverEmails = () =>
  withJobLock("deliverEmails", JOB_LOCK_IDS.deliverEmails, () => EmailDeliveryService.Instance.deliverPending());

export const deliverPush = () =>
  withJobLock("deliverPush", JOB_LOCK_IDS.deliverPush, () => PushDeliveryService.Instance.deliverPending());

export const processAccountDeletions = () =>
  withJobLock("processAccountDeletions", JOB_LOCK_IDS.processAccountDeletions, () =>
    AccountDeletionService.Instance.processDue(),
  );

export const pruneDevices = () =>
  withJobLock("pruneDevices", JOB_LOCK_IDS.pruneDevices, async () => ({
    removed: await PushDeliveryService.Instance.pruneStaleDevices(),
  }));

/** The platform admin's alert rules (what needs attention). Runs after the other jobs, so it sees how they went. */
export const evaluateAdminAlerts = () =>
  withJobLock("evaluateAdminAlerts", JOB_LOCK_IDS.evaluateAdminAlerts, () => AlertService.Instance.evaluate());

/** Platform announcements: one batch of businesses per run. */
export const deliverAnnouncements = () =>
  withJobLock("deliverAnnouncements", JOB_LOCK_IDS.deliverAnnouncements, () =>
    AnnouncementService.Instance.deliverNext(),
  );

/** The platform's daily figures (trends), recomputed for the last few days. */
export const rollupPlatformStats = () =>
  withJobLock("rollupPlatformStats", JOB_LOCK_IDS.rollupPlatformStats, () => InsightsService.Instance.rollup());

/** Security counters older than their retention. */
export const purgeMonitoringData = () =>
  withJobLock("purgeMonitoringData", JOB_LOCK_IDS.purgeMonitoringData, async () => ({
    securityWindows: await SecurityCounterRepository.Instance.purgeOlderThan(SECURITY.retentionDays),
  }));

let lastPurgeAt = 0;
let lastAlertsAt = 0;

/** One pass over the jobs. `all` forces the occasional ones too. */
export async function runTick(options: { all?: boolean } = {}): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  results.sendAppointmentReminders = await sendAppointmentReminders();
  // Before email and push delivery, so this run's announcement copies go out this run.
  results.deliverAnnouncements = await deliverAnnouncements();
  results.deliverEmails = await deliverEmails();
  results.deliverPush = await deliverPush();

  if (options.all || Date.now() - lastPurgeAt >= JOBS.purgeEveryMs) {
    lastPurgeAt = Date.now();
    results.purgeIdempotencyKeys = await purgeIdempotencyKeys();
    results.pruneDevices = await pruneDevices();
    results.processAccountDeletions = await processAccountDeletions();
    results.rollupPlatformStats = await rollupPlatformStats();
    results.purgeMonitoringData = await purgeMonitoringData();
  }
  if (options.all || Date.now() - lastAlertsAt >= JOBS.alertsEveryMs) {
    lastAlertsAt = Date.now();
    results.evaluateAdminAlerts = await evaluateAdminAlerts();
  }
  return results;
}
