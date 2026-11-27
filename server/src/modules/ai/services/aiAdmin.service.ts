import { runInTransaction } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { ActivityService } from "../../activity/services/activity.service";
import { AI_FEATURE_INFO, AI_FEATURES } from "../domain/aiFeatures";
import type { AiAdminOverviewDTO, AiSettingsDTO, AiUsageSummaryDTO } from "../dto/ai.dto";
import { AiSettingsRepository } from "../repositories/aiAllowance.repository";
import { AiUsageRepository } from "../repositories/aiUsage.repository";
import { AiCredentialService } from "./aiCredential.service";

/** The platform admin's AI page: keys, per-feature models, the daily allowance, and how AI is being used. */
export class AiAdminService {
  static Instance = new AiAdminService();

  private constructor(
    private readonly credentials = AiCredentialService.Instance,
    private readonly settings = AiSettingsRepository.Instance,
    private readonly usage = AiUsageRepository.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  async overview(): Promise<AiAdminOverviewDTO> {
    const [settings, credentials] = await Promise.all([this.getSettings(), this.credentials.list()]);
    return {
      settings,
      credentials,
      features: AI_FEATURES.map((id) => ({ id, ...AI_FEATURE_INFO[id] })),
    };
  }

  async getSettings(): Promise<AiSettingsDTO> {
    const row = await this.settings.get();
    return { dailyLimit: row.dailyLimit, storageReady: this.credentials.storageReady, updatedAt: row.updatedAt };
  }

  async updateSettings(actor: Actor, dailyLimit: number): Promise<AiSettingsDTO> {
    await runInTransaction(async (tx) => {
      const before = await this.settings.update(dailyLimit, actor.id, tx);
      await this.activity.audit(
        {
          businessId: null,
          actorId: actor.id,
          action: "admin.ai_settings_updated",
          entityType: "ai_settings",
          entityId: null,
          payload: { dailyLimit: { from: before, to: dailyLimit } },
        },
        tx,
      );
    });
    return this.getSettings();
  }

  async usageSummary(days: number): Promise<AiUsageSummaryDTO> {
    const { dailyLimit } = await this.settings.get();
    return this.usage.summary(days, dailyLimit);
  }
}
