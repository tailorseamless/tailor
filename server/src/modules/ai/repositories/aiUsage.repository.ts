import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { BaseRepository } from "../../../shared/repositories/baseRepository";
import type { AiUsageSummaryDTO } from "../dto/ai.dto";
import { AiUsageLog } from "../entities/aiUsageLog.entity";

export type AiUsageInput = Pick<
  AiUsageLog,
  | "businessId"
  | "userId"
  | "provider"
  | "model"
  | "feature"
  | "inputTokens"
  | "outputTokens"
  | "status"
  | "errorKind"
  | "durationMs"
>;

const toInt = (value: unknown) => Number(value ?? 0);

/** Append-only. Index: ai_usage_logs(created_at), (business_id, created_at). */
export class AiUsageRepository extends BaseRepository<AiUsageLog> {
  static Instance = new AiUsageRepository();

  private constructor() {
    super(AiUsageLog);
  }

  async record(row: AiUsageInput): Promise<void> {
    await this.repo().insert(row);
  }

  /** Every list is bounded (top 10, or grouped by a handful of features, models and error kinds). */
  async summary(days: number): Promise<Omit<AiUsageSummaryDTO, "businessesOutOfTokens">> {
    const since = [days];
    const window = `created_at > now() - make_interval(days => $1)`;
    const [totals] = await AppDataSource.query(
      `SELECT COUNT(*) AS requests, COUNT(*) FILTER (WHERE status = 'error') AS failed,
              COALESCE(SUM(input_tokens), 0) AS input, COALESCE(SUM(output_tokens), 0) AS output
         FROM ai_usage_logs WHERE ${window}`,
      since,
    );
    const byFeature: { feature: string; requests: string; failed: string }[] = await AppDataSource.query(
      `SELECT feature, COUNT(*) AS requests, COUNT(*) FILTER (WHERE status = 'error') AS failed
         FROM ai_usage_logs WHERE ${window} GROUP BY feature ORDER BY COUNT(*) DESC`,
      since,
    );
    const byModel: Record<string, string>[] = await AppDataSource.query(
      `SELECT provider, model, COUNT(*) AS requests, COUNT(*) FILTER (WHERE status = 'error') AS failed,
              COALESCE(SUM(input_tokens), 0) AS input, COALESCE(SUM(output_tokens), 0) AS output
         FROM ai_usage_logs WHERE ${window} GROUP BY provider, model ORDER BY COUNT(*) DESC LIMIT 20`,
      since,
    );
    const byError: { error_kind: string; requests: string }[] = await AppDataSource.query(
      `SELECT error_kind, COUNT(*) AS requests FROM ai_usage_logs
        WHERE ${window} AND status = 'error' GROUP BY error_kind ORDER BY COUNT(*) DESC`,
      since,
    );
    const top: { id: string; name: string; requests: string }[] = await AppDataSource.query(
      `SELECT b.id, b.name, COUNT(*) AS requests FROM ai_usage_logs l JOIN businesses b ON b.id = l.business_id
        WHERE l.${window} GROUP BY b.id, b.name ORDER BY COUNT(*) DESC LIMIT 10`,
      since,
    );
    return {
      days,
      totals: {
        requests: toInt(totals?.requests),
        failed: toInt(totals?.failed),
        inputTokens: toInt(totals?.input),
        outputTokens: toInt(totals?.output),
      },
      byFeature: byFeature.map((row) => ({
        feature: row.feature as AiUsageSummaryDTO["byFeature"][number]["feature"],
        requests: toInt(row.requests),
        failed: toInt(row.failed),
      })),
      byModel: byModel.map((row) => ({
        provider: row.provider as AiUsageSummaryDTO["byModel"][number]["provider"],
        model: row.model,
        requests: toInt(row.requests),
        failed: toInt(row.failed),
        inputTokens: toInt(row.input),
        outputTokens: toInt(row.output),
      })),
      byError: byError.map((row) => ({ errorKind: row.error_kind ?? "unknown", requests: toInt(row.requests) })),
      topBusinesses: top.map((row) => ({ businessId: row.id, name: row.name, requests: toInt(row.requests) })),
    };
  }

  /** Key or model failures in the last hour that only the platform admin can fix (for the admin alert). */
  async recentSetupFailures(): Promise<{ provider: string; model: string; errorKind: string; failures: number }[]> {
    const rows: { provider: string; model: string; error_kind: string; failures: string }[] = await AppDataSource.query(
      `SELECT provider, model, error_kind, COUNT(*) AS failures FROM ai_usage_logs
        WHERE created_at > now() - interval '1 hour' AND status = 'error'
          AND error_kind IN ('auth','account','invalid_request') AND business_id IS NOT NULL
        GROUP BY provider, model, error_kind`,
    );
    return rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      errorKind: row.error_kind,
      failures: toInt(row.failures),
    }));
  }
}
