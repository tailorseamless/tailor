import { env } from "../../../config/env";
import {
  AI_PROVIDER_LABELS,
  AiProviderError,
  redactKey,
  type AiProviderId,
} from "../../../infrastructure/ai/aiProvider";
import { modelTier } from "../../../infrastructure/ai/modelTiers";
import { providerFor, type AiProviderResolver } from "../../../infrastructure/ai/providers";
import { checkServerAddress, OLLAMA_CLOUD } from "../../../infrastructure/ai/serverAddress";
import { logger } from "../../../infrastructure/logger/logger";
import { AppError } from "../../../shared/errors/AppError";
import { runInTransaction } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { open, seal } from "../../../shared/utils/secretBox";
import { ActivityService } from "../../activity/services/activity.service";
import type { AiFeature } from "../domain/aiFeatures";
import type { AiCredentialDTO, AiModelDTO, ResolvedCredential } from "../dto/ai.dto";
import type { AiCredential } from "../entities/aiCredential.entity";
import { AiCredentialRepository } from "../repositories/aiCredential.repository";
import type { ListModelsInput, SaveCredentialInput } from "../validators/ai.schema";

/** Bound into the encryption, so a stored key only opens as this provider's platform key. */
const contextFor = (provider: AiProviderId) => `platform:${provider}`;

/** Hosted providers' keys are long; anything shorter is a typing mistake. Ollama keys may be any length. */
const MIN_HOSTED_KEY_LENGTH = 10;

const STORAGE_OFF =
  "AI keys can't be saved yet: the server needs its AI_KEYS_SECRET setting. Add it (openssl rand -base64 32) and restart the server.";

/**
 * The platform's AI provider keys (platform key only: businesses never hold one). A key is checked with its
 * provider BEFORE it is stored, stored only encrypted, and never returned, logged or put in an error.
 */
export class AiCredentialService {
  static Instance = new AiCredentialService();

  private constructor(
    private readonly credentials = AiCredentialRepository.Instance,
    private readonly activity = ActivityService.Instance,
    private readonly providers: AiProviderResolver = providerFor,
  ) {}

  get storageReady(): boolean {
    return env.ai.configured;
  }

  async list(): Promise<AiCredentialDTO[]> {
    return (await this.credentials.list()).map((row) => this.toDTO(row));
  }

  /** Saves (or changes) a provider's key, model and address, after the provider has accepted the key. */
  async save(actor: Actor, provider: AiProviderId, input: SaveCredentialInput): Promise<AiCredentialDTO> {
    const secret = this.secret();
    const existing = await this.credentials.findByProvider(provider);
    const baseUrl = this.serverAddress(provider, input.baseUrl ?? existing?.baseUrl ?? undefined);
    const apiKey = this.keyFor(provider, input.apiKey, existing, secret);

    const models = await this.verify(provider, apiKey, baseUrl);
    // Ollama names carry tags (":latest") and cloud models may not be listed, so only hosted models are checked.
    if (provider !== "ollama" && models.length > 0 && !models.some((model) => model.id === input.model)) {
      throw AppError.unprocessable(`${AI_PROVIDER_LABELS[provider]} doesn't offer "${input.model}" to this key`, [
        { field: "model", message: "Choose a model from the list" },
      ]);
    }

    const saved = await runInTransaction(async (tx) => {
      const hasActive = Boolean(await this.credentials.findActive(tx));
      const row = await this.credentials.save(
        {
          ...(existing ? { id: existing.id, featureModels: existing.featureModels } : { featureModels: {} }),
          provider,
          model: input.model,
          baseUrl,
          keyCiphertext: seal(apiKey, secret, contextFor(provider)),
          // A short key (possible for Ollama) would be given away by its last 4 characters.
          keyLast4: apiKey.length >= 12 ? apiKey.slice(-4) : "",
          isActive: existing?.isActive ?? false,
          updatedBy: actor.id,
        },
        tx,
      );
      // The first key saved is put in use straight away; later ones only when asked.
      const activate = !row.isActive && (input.makeActive === true || !hasActive);
      if (activate) await this.credentials.makeActive(provider, actor.id, tx);
      await this.activity.audit(
        {
          businessId: null,
          actorId: actor.id,
          action: "admin.ai_key_saved",
          entityType: "ai_credential",
          entityId: row.id,
          payload: {
            provider,
            model: input.model,
            keyChanged: Boolean(input.apiKey),
            active: row.isActive || activate,
          },
        },
        tx,
      );
      return (await this.credentials.findByProvider(provider, tx)) ?? row;
    });
    return this.toDTO(saved);
  }

  /** The provider's text models for a typed key (or the saved one): the picker, and a check before saving. */
  async models(provider: AiProviderId, input: ListModelsInput): Promise<AiModelDTO[]> {
    const existing = await this.credentials.findByProvider(provider);
    const baseUrl = this.serverAddress(provider, input.baseUrl ?? existing?.baseUrl ?? undefined);
    const apiKey = this.keyFor(provider, input.apiKey, existing, env.ai.keysSecret);
    return this.verify(provider, apiKey, baseUrl);
  }

  async activate(actor: Actor, provider: AiProviderId): Promise<AiCredentialDTO> {
    const existing = await this.credentials.findByProvider(provider);
    if (!existing) throw AppError.notFound("No key is saved for that provider");
    if (!this.readable(existing)) {
      throw AppError.unprocessable("This key can't be read any more. Save it again before putting it in use.");
    }
    await runInTransaction(async (tx) => {
      await this.credentials.makeActive(provider, actor.id, tx);
      await this.activity.audit(
        {
          businessId: null,
          actorId: actor.id,
          action: "admin.ai_key_activated",
          entityType: "ai_credential",
          entityId: existing.id,
          payload: { provider },
        },
        tx,
      );
    });
    return this.toDTO({ ...existing, isActive: true });
  }

  /** Deletes the row, ciphertext and all. Features pinned to it go back to the key in use. */
  async remove(actor: Actor, provider: AiProviderId): Promise<void> {
    const existing = await this.credentials.findByProvider(provider);
    if (!existing) throw AppError.notFound("No key is saved for that provider");
    await runInTransaction(async (tx) => {
      await this.credentials.remove(provider, tx);
      await this.activity.audit(
        {
          businessId: null,
          actorId: actor.id,
          action: "admin.ai_key_removed",
          entityType: "ai_credential",
          entityId: existing.id,
          payload: { provider, wasActive: existing.isActive },
        },
        tx,
      );
    });
  }

  /** Pins a feature to one saved key and model, or (null) returns it to the key in use. */
  async setFeatureModel(
    actor: Actor,
    feature: AiFeature,
    choice: { provider: AiProviderId; model: string } | null,
  ): Promise<AiCredentialDTO[]> {
    const target = choice ? await this.credentials.findByProvider(choice.provider) : null;
    if (choice && !target) {
      throw AppError.unprocessable(`Save a ${AI_PROVIDER_LABELS[choice.provider]} key first`, [
        { field: "provider", message: "No key is saved for this provider" },
      ]);
    }
    await runInTransaction(async (tx) => {
      await this.credentials.unpin(feature, tx);
      if (choice) await this.credentials.pin(choice.provider, feature, choice.model, actor.id, tx);
      await this.activity.audit(
        {
          businessId: null,
          actorId: actor.id,
          action: "admin.ai_feature_model_set",
          entityType: "ai_credential",
          entityId: target?.id ?? null,
          payload: { feature, provider: choice?.provider ?? null, model: choice?.model ?? null },
        },
        tx,
      );
    });
    return this.list();
  }

  /**
   * The key and model a request uses: the key the feature is pinned to, else the key in use. A key that
   * can't be decrypted (AI_KEYS_SECRET changed) is skipped, falling through to the next.
   */
  async resolveFor(feature?: AiFeature): Promise<ResolvedCredential | null> {
    const secret = env.ai.keysSecret;
    if (!secret) return null;
    const pinned = feature ? await this.credentials.findPinned(feature) : null;
    if (pinned && feature) {
      const apiKey = open(pinned.keyCiphertext, secret, contextFor(pinned.provider));
      const model = pinned.featureModels[feature];
      if (apiKey !== null && model) {
        return { apiKey, provider: pinned.provider, model, baseUrl: pinned.baseUrl };
      }
      logger.warn({ provider: pinned.provider, feature }, "pinned AI key could not be decrypted; using the active key");
    }
    const active = await this.credentials.findActive();
    if (!active) return null;
    const apiKey = open(active.keyCiphertext, secret, contextFor(active.provider));
    if (apiKey === null) {
      logger.warn({ provider: active.provider }, "active AI key could not be decrypted (AI_KEYS_SECRET changed?)");
      return null;
    }
    return { apiKey, provider: active.provider, model: active.model, baseUrl: active.baseUrl };
  }

  private secret(): string {
    if (!env.ai.keysSecret) throw AppError.unavailable(STORAGE_OFF);
    return env.ai.keysSecret;
  }

  /** Ollama only: the server to call (default Ollama Cloud), checked against private networks. */
  private serverAddress(provider: AiProviderId, raw: string | undefined): string | null {
    if (provider !== "ollama") return null;
    const checked = checkServerAddress(raw?.trim() || OLLAMA_CLOUD, !env.isProduction);
    if ("problem" in checked) {
      throw AppError.unprocessable(checked.problem, [{ field: "baseUrl", message: checked.problem }]);
    }
    return checked.url;
  }

  /** The typed key, else the saved one. Never echoed back in any message. */
  private keyFor(
    provider: AiProviderId,
    typed: string | undefined,
    existing: AiCredential | null,
    secret: string | null,
  ): string {
    if (typed) {
      if (provider !== "ollama" && typed.length < MIN_HOSTED_KEY_LENGTH) {
        throw AppError.unprocessable("That doesn't look like a whole API key", [
          { field: "apiKey", message: "Paste the whole key" },
        ]);
      }
      return typed;
    }
    if (existing) {
      const saved = secret ? open(existing.keyCiphertext, secret, contextFor(provider)) : null;
      if (saved !== null) return saved;
      throw AppError.unprocessable("The saved key can't be read any more. Enter the key again.", [
        { field: "apiKey", message: "Enter the key again" },
      ]);
    }
    // Your own Ollama server may need no key; Ollama Cloud and the hosted providers do (their check will say so).
    if (provider === "ollama") return "";
    throw AppError.unprocessable("Enter the API key", [{ field: "apiKey", message: "Enter the API key" }]);
  }

  /** Asks the provider for its models: proves the key works. A rejected key is the admin's to fix (422). */
  private async verify(provider: AiProviderId, apiKey: string, baseUrl: string | null): Promise<AiModelDTO[]> {
    const label = AI_PROVIDER_LABELS[provider];
    try {
      const models = await this.providers(provider).listModels(apiKey, baseUrl ?? undefined);
      return models.map((model) => ({ id: model.id, label: model.label, tier: modelTier(provider, model.id) }));
    } catch (err) {
      const kind = err instanceof AiProviderError ? err.kind : "unavailable";
      logger.warn(
        {
          provider,
          kind,
          providerMessage: redactKey(err instanceof AiProviderError ? err.detail.slice(0, 600) : String(err), apiKey),
        },
        "AI key check failed",
      );
      if (kind === "auth") {
        throw AppError.unprocessable(`${label} did not accept this API key`, [
          { field: "apiKey", message: `${label} did not accept this API key` },
        ]);
      }
      if (kind === "account") {
        throw AppError.unprocessable(
          `${label} accepted the key, but the account behind it has no access or credit left`,
          [{ field: "apiKey", message: "Check the account's plan and balance" }],
        );
      }
      throw new AppError(
        provider === "ollama"
          ? `${label} could not be reached at that address. Check it and try again.`
          : `${label} could not be reached to check the key. Try again in a moment.`,
        502,
      );
    }
  }

  private readable(row: AiCredential): boolean {
    const secret = env.ai.keysSecret;
    return secret !== null && open(row.keyCiphertext, secret, contextFor(row.provider)) !== null;
  }

  private toDTO(row: AiCredential): AiCredentialDTO {
    return {
      id: row.id,
      provider: row.provider,
      providerLabel: AI_PROVIDER_LABELS[row.provider],
      model: row.model,
      modelTier: modelTier(row.provider, row.model),
      featureModels: row.featureModels ?? {},
      baseUrl: row.baseUrl,
      keyLast4: row.keyLast4,
      isActive: row.isActive,
      readable: this.readable(row),
      updatedAt: row.updatedAt,
    };
  }
}
