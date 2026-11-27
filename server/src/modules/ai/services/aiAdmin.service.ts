import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { ActivityService } from "../../activity/services/activity.service";
import { AI_FEATURE_INFO, AI_FEATURES } from "../domain/aiFeatures";
import type { AiAdminOverviewDTO, AiSettingsDTO, AiTokenBalanceDTO, AiUsageSummaryDTO } from "../dto/ai.dto";
import { AiSettingsRepository } from "../repositories/aiSettings.repository";
import { AiTokenRepository } from "../repositories/aiToken.repository";
import { AiUsageRepository } from "../repositories/aiUsage.repository";
import { AiCredentialService } from "./aiCredential.service";

/** The platform admin's AI page: keys, per-feature models, each business's tokens, and how AI is being used. */
export class AiAdminService {
  static Instance = new AiAdminService();

  private constructor(
    private readonly credentials = AiCredentialService.Instance,
    private readonly settings = AiSettingsRepository.Instance,
    private readonly tokens = AiTokenRepository.Instance,
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
    return {
      startingTokens: row.startingTokens,
      storageReady: this.credentials.storageReady,
      updatedAt: row.updatedAt,
    };
  }

  async updateSettings(actor: Actor, startingTokens: number): Promise<AiSettingsDTO> {
    await runInTransaction(async (tx) => {
      const before = await this.settings.update(startingTokens, actor.id, tx);
      await this.activity.audit(
        {
          businessId: null,
          actorId: actor.id,
          action: "admin.ai_settings_updated",
          entityType: "ai_settings",
          entityId: null,
          payload: { startingTokens: { from: before, to: startingTokens } },
        },
        tx,
      );
    });
    return this.getSettings();
  }

  async balances(params: { search?: string; page: number; limit: number }): Promise<Paginated<AiTokenBalanceDTO>> {
    const { startingTokens } = await this.settings.get();
    return this.tokens.balances({ ...params, startingTokens });
  }

  /** Adds tokens to a business (or, below zero, takes some back, never below nothing). */
  async grant(actor: Actor, businessId: string, amount: number, note: string | null): Promise<{ tokens: number }> {
    const { startingTokens } = await this.settings.get();
    return runInTransaction(async (tx) => {
      if (!(await this.tokens.businessExists(businessId, tx))) throw AppError.notFound("Business not found");
      const balance = await this.tokens.grant(businessId, startingTokens, amount, note, actor.id, tx);
      if (balance === null) {
        throw AppError.unprocessable("That is more than the business has", [
          { field: "amount", message: "More than the business has" },
        ]);
      }
      await this.activity.audit(
        {
          businessId,
          actorId: actor.id,
          action: "admin.ai_tokens_granted",
          entityType: "ai_token_account",
          entityId: businessId,
          payload: { amount, balance },
        },
        tx,
      );
      return { tokens: balance };
    });
  }

  async usageSummary(days: number): Promise<AiUsageSummaryDTO> {
    const [summary, businessesOutOfTokens] = await Promise.all([this.usage.summary(days), this.tokens.countEmpty()]);
    return { ...summary, businessesOutOfTokens };
  }
}
