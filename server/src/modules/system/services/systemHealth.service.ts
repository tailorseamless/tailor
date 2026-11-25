import { env } from "../../../config/env";
import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { MailerService } from "../../../shared/services/mailer.service";
import type { SystemHealthDTO } from "../dto/system.dto";
import { JobStatusRepository } from "../repositories/jobStatus.repository";
import { SecurityCounterRepository } from "../repositories/securityCounter.repository";
import { SystemHealthRepository } from "../repositories/systemHealth.repository";

/**
 * Is the application healthy? For the admin's System health tab. Error TEXT (job failures, email
 * provider errors) is technical and may quote addresses, so it is only included for `admin.technical`.
 */
export class SystemHealthService {
  static Instance = new SystemHealthService();

  private constructor(
    private readonly health = SystemHealthRepository.Instance,
    private readonly jobs = JobStatusRepository.Instance,
    private readonly mailer = MailerService.Instance,
    private readonly security = SecurityCounterRepository.Instance,
  ) {}

  async check(options: { technical: boolean }): Promise<SystemHealthDTO> {
    const ok = await this.health.ping();
    if (!ok) {
      // Nothing else can be read without the database; say so rather than fail.
      return {
        checkedAt: new Date(),
        api: this.api(),
        database: { ok: false, pendingMigrations: null },
        jobs: { inProcess: env.jobs.inProcess, list: [] },
        email: { ...this.emptyDelivery(), enabled: this.mailer.enabled, recentFailures: [] },
        push: { ...this.emptyDelivery(), enabled: env.push.enabled },
        errorMonitoring: { enabled: Boolean(env.monitoring.sentryDsn) },
        security: { last24h: {}, topSources: [] },
      };
    }
    const [pendingMigrations, jobs, email, push, failures, securityTotals, topSources] = await Promise.all([
      AppDataSource.showMigrations().catch(() => null),
      this.jobs.list(),
      this.health.email(),
      this.health.push(),
      options.technical ? this.health.recentEmailFailures() : Promise.resolve([]),
      this.security.totals24h(),
      options.technical ? this.security.topSources() : Promise.resolve([]),
    ]);
    return {
      checkedAt: new Date(),
      api: this.api(),
      database: { ok: true, pendingMigrations },
      jobs: {
        inProcess: env.jobs.inProcess,
        list: jobs.map((job) => ({ ...job, lastError: options.technical ? job.lastError : null })),
      },
      email: { ...email, enabled: this.mailer.enabled, recentFailures: failures },
      push: { ...push, enabled: env.push.enabled },
      errorMonitoring: { enabled: Boolean(env.monitoring.sentryDsn) },
      security: { last24h: securityTotals, topSources },
    };
  }

  private api(): SystemHealthDTO["api"] {
    return { uptimeSeconds: Math.round(process.uptime()), nodeVersion: process.version, environment: env.nodeEnv };
  }

  private emptyDelivery() {
    return { last24h: { sent: 0, failed: 0, cancelled: 0 }, pending: 0, oldestPendingAt: null };
  }
}
