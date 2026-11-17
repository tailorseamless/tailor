import { JOB_LOCK_IDS, JOBS } from "../config/constants";
import { AccountDeletionService } from "../modules/accounts/services/accountDeletion.service";
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

let lastPurgeAt = 0;

/** One pass over the jobs. `all` forces the occasional ones too. */
export async function runTick(options: { all?: boolean } = {}): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  results.sendAppointmentReminders = await sendAppointmentReminders();
  results.deliverEmails = await deliverEmails();
  results.deliverPush = await deliverPush();

  if (options.all || Date.now() - lastPurgeAt >= JOBS.purgeEveryMs) {
    lastPurgeAt = Date.now();
    results.purgeIdempotencyKeys = await purgeIdempotencyKeys();
    results.pruneDevices = await pruneDevices();
    results.processAccountDeletions = await processAccountDeletions();
  }
  return results;
}
