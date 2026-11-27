import { z } from "zod";
import { env } from "../../../config/env";
import {
  AI_PROVIDER_LABELS,
  AiProviderError,
  redactKey,
  type AiGenerateResult,
  type AiImage,
  type AiProvider,
  type AiProviderId,
} from "../../../infrastructure/ai/aiProvider";
import { providerFor, type AiProviderResolver } from "../../../infrastructure/ai/providers";
import { logger } from "../../../infrastructure/logger/logger";
import type { Actor } from "../../../shared/services/access.service";
import {
  AiRequestError,
  badOutputError,
  limitReachedError,
  notSetUpError,
  toRequestError,
  type AiAudience,
} from "../domain/aiErrors";
import type { AiFeature, AiUsageFeature } from "../domain/aiFeatures";
import { describeRejection, parseJson } from "../domain/lenient";
import type { AiStatusDTO, AiTestResultDTO, ResolvedCredential } from "../dto/ai.dto";
import { AiAllowanceRepository, AiSettingsRepository } from "../repositories/aiAllowance.repository";
import { AiUsageRepository } from "../repositories/aiUsage.repository";
import { AiCredentialService } from "./aiCredential.service";

export interface GenerateJsonRequest<T> {
  feature: AiFeature;
  system: string;
  prompt: string;
  images?: AiImage[];
  /**
   * The photos ARE the material (reading a photographed record): a model that can't see fails with a clear
   * message instead of being asked again without them.
   */
  imagesRequired?: boolean;
  /** Lenient Zod schema for the reply. */
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  schemaName: string;
  /** Hand-written JSON Schema mirroring `schema`: every property required, additionalProperties false. */
  jsonSchema: Record<string, unknown>;
  /** Default 16000. */
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** A friendlier message when the Zod reason contains `includes`. */
  rejectionHints?: { includes: string; message: string }[];
}

export interface GenerateJsonResult<T> {
  data: T;
  /** The model could not see, so the request was answered without the pictures. */
  imagesIgnored: boolean;
  provider: AiProviderId;
  providerLabel: string;
  model: string;
}

/** Who a request is for, and whether it counts against a business's daily allowance. */
interface Caller {
  userId: string;
  businessId: string | null;
  audience: AiAudience;
  metered: boolean;
}

/** A reply that came back but could not be used: its tokens are still logged, and the use is given back. */
class UnusableReply extends Error {
  constructor(
    public readonly result: AiGenerateResult,
    public readonly mapped: AiRequestError,
  ) {
    super("unusable AI reply");
  }
}

const VISION_PROBLEM = /image|vision|multimodal|modalit/i;

const testSchema = z.object({ reply: z.string().min(1) });
const TEST_JSON_SCHEMA = {
  type: "object",
  properties: { reply: { type: "string", description: "One short, friendly sentence." } },
  required: ["reply"],
  additionalProperties: false,
};

/**
 * The ONLY thing feature code calls for AI. It picks the platform key and model, takes one use of the
 * business's daily allowance, calls the provider, parses and checks the reply (asking once more with what
 * was wrong), logs counts only, gives the use back when nothing usable came of it, and turns provider
 * failures into messages a person can act on.
 */
export class AiService {
  static Instance = new AiService();

  private constructor(
    private readonly credentials = AiCredentialService.Instance,
    private readonly allowance = AiAllowanceRepository.Instance,
    private readonly settings = AiSettingsRepository.Instance,
    private readonly usage = AiUsageRepository.Instance,
    private readonly providers: AiProviderResolver = providerFor,
  ) {}

  /** A structured draft for a business member: counts against the business's allowance. */
  generateJson<T>(actor: Actor, request: GenerateJsonRequest<T>): Promise<GenerateJsonResult<T>> {
    return this.generate(
      { userId: actor.id, businessId: actor.businessId, audience: "member", metered: true },
      request.feature,
      request,
    );
  }

  /** What a screen needs to offer an AI feature: available or not (and why), and what's left today. */
  async status(actor: Actor, feature?: AiFeature): Promise<AiStatusDTO> {
    const [credential, settings, usedToday] = await Promise.all([
      this.credentials.resolveFor(feature),
      this.settings.get(),
      this.allowance.usedToday(actor.businessId),
    ]);
    const dailyLimit = settings.dailyLimit;
    const remainingToday = Math.max(0, dailyLimit - usedToday);
    let unavailableReason: string | null = null;
    if (!credential) unavailableReason = notSetUpError("member").message;
    else if (dailyLimit === 0 || remainingToday === 0) unavailableReason = limitReachedError(dailyLimit).message;
    return {
      available: unavailableReason === null,
      unavailableReason,
      providerLabel: credential ? AI_PROVIDER_LABELS[credential.provider] : null,
      model: credential?.model ?? null,
      dailyLimit,
      usedToday,
      remainingToday,
    };
  }

  /** The platform admin's check that a key and model really answer. Belongs to no business, uses no allowance. */
  async test(actor: Actor, feature?: AiFeature): Promise<AiTestResultDTO> {
    const started = Date.now();
    const caller: Caller = { userId: actor.id, businessId: null, audience: "admin", metered: false };
    let tokens = { inputTokens: 0, outputTokens: 0 };
    const result = await this.attempt(caller, "admin_test", feature, async (provider, credential) => {
      const reply = await this.ask(provider, credential, caller, {
        feature: feature ?? "record_capture",
        system: "You are checking that an AI connection works. Answer in JSON only.",
        prompt: "Write one short, friendly sentence welcoming a tailor to Tailor Seamless.",
        schema: testSchema,
        schemaName: "connection_test",
        jsonSchema: TEST_JSON_SCHEMA,
        maxOutputTokens: 1000,
        timeoutMs: 60_000,
      });
      tokens = reply.tokens;
      return reply;
    });
    return {
      provider: result.provider,
      providerLabel: result.providerLabel,
      model: result.model,
      reply: result.data.reply.slice(0, 300),
      durationMs: Date.now() - started,
      ...tokens,
    };
  }

  private async generate<T>(
    caller: Caller,
    feature: AiFeature,
    request: GenerateJsonRequest<T>,
  ): Promise<GenerateJsonResult<T>> {
    return this.attempt(caller, feature, feature, (provider, credential) =>
      this.ask(provider, credential, caller, request),
    );
  }

  /**
   * Shared by every request: key → allowance → call → log. On ANY failure the allowance use is given back
   * (a request that produced nothing usable costs nobody anything) and the error is mapped for the caller.
   */
  private async attempt<T>(
    caller: Caller,
    usageFeature: AiUsageFeature,
    feature: AiFeature | undefined,
    call: (
      provider: AiProvider,
      credential: ResolvedCredential,
    ) => Promise<{ data: T; imagesIgnored: boolean; tokens: { inputTokens: number; outputTokens: number } }>,
  ): Promise<GenerateJsonResult<T>> {
    const credential = await this.credentials.resolveFor(feature);
    if (!credential) throw notSetUpError(caller.audience);

    let reservedDay: string | null = null;
    if (caller.metered && caller.businessId) {
      const { dailyLimit } = await this.settings.get();
      if (dailyLimit === 0) throw limitReachedError(0);
      reservedDay = await this.allowance.reserve(caller.businessId, dailyLimit);
      if (!reservedDay) throw limitReachedError(dailyLimit);
    }

    const providerLabel = AI_PROVIDER_LABELS[credential.provider];
    const started = Date.now();
    const noTokens = { inputTokens: 0, outputTokens: 0 };
    // Bookkeeping must never fail the request it describes.
    const log = (tokens: { inputTokens: number; outputTokens: number }, errorKind: string | null) =>
      this.usage
        .record({
          businessId: caller.businessId,
          userId: caller.userId,
          provider: credential.provider,
          model: credential.model,
          feature: usageFeature,
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          status: errorKind ? "error" : "ok",
          errorKind,
          durationMs: Date.now() - started,
        })
        .catch((err: unknown) => logger.error({ err }, "could not record AI usage"));

    try {
      const result = await call(this.providers(credential.provider), credential);
      await log(result.tokens, null);
      return {
        data: result.data,
        imagesIgnored: result.imagesIgnored,
        provider: credential.provider,
        providerLabel,
        model: credential.model,
      };
    } catch (err) {
      if (reservedDay && caller.businessId) {
        await this.allowance
          .release(caller.businessId, reservedDay)
          .catch((releaseErr: unknown) => logger.error({ err: releaseErr }, "could not give back an AI allowance use"));
      }
      if (err instanceof UnusableReply) {
        await log(err.result, "invalid_output");
        this.warn(caller, usageFeature, credential, err.mapped, err.result.text);
        throw err.mapped;
      }
      if (err instanceof AiRequestError) {
        // Only the "this model can't read photos" case reaches here: the provider refused the request itself.
        await log(noTokens, "invalid_request");
        this.warn(caller, usageFeature, credential, err);
        throw err;
      }
      if (err instanceof AiProviderError) {
        await log(noTokens, err.kind);
        const mapped = toRequestError(err, caller.audience, providerLabel, credential.model) as AiRequestError;
        this.warn(caller, usageFeature, credential, mapped);
        throw mapped;
      }
      throw err;
    }
  }

  /** Send, check, and ask ONCE more with what was wrong. Both attempts' tokens are counted. */
  private async ask<T>(
    provider: AiProvider,
    credential: ResolvedCredential,
    caller: Caller,
    request: GenerateJsonRequest<T>,
  ): Promise<{ data: T; imagesIgnored: boolean; tokens: { inputTokens: number; outputTokens: number } }> {
    let images = request.images ?? [];
    let imagesIgnored = false;

    const send = (prompt: string, pictures: AiImage[]) =>
      provider.generate(credential.apiKey, {
        model: credential.model,
        baseUrl: credential.baseUrl ?? undefined,
        system: request.system,
        prompt,
        images: pictures,
        schemaName: request.schemaName,
        jsonSchema: request.jsonSchema,
        maxOutputTokens: request.maxOutputTokens ?? 16_000,
        timeoutMs: request.timeoutMs ?? env.ai.requestTimeoutMs,
      });

    const sendOnce = async (prompt: string): Promise<AiGenerateResult> => {
      try {
        return await send(prompt, images);
      } catch (err) {
        const visionProblem =
          images.length > 0 &&
          err instanceof AiProviderError &&
          (err.kind === "invalid_request" || VISION_PROBLEM.test(err.detail));
        if (!visionProblem) throw err;
        if (request.imagesRequired) {
          throw new AiRequestError(
            caller.audience === "admin"
              ? `"${credential.model}" can't read photos. Choose a model that can see images for this feature.`
              : "AI can't read photos right now. Tailor Seamless has been told. Please try again later.",
            502,
            "model_rejected",
            { status: err.status, message: err.detail.slice(0, 600) },
          );
        }
        // The model can't see: the same request without the pictures, and the screen is told.
        images = [];
        imagesIgnored = true;
        return send(prompt, []);
      }
    };

    const check = (text: string): { ok: true; data: T } | { ok: false; problem: string } => {
      const json = parseJson(text);
      const parsed = request.schema.safeParse(json);
      return parsed.success
        ? { ok: true, data: parsed.data }
        : { ok: false, problem: describeRejection(json, json === undefined ? null : parsed.error) };
    };

    let result = await sendOnce(request.prompt);
    let checked = check(result.text);
    if (!checked.ok) {
      const again = await sendOnce(
        `${request.prompt}\n\nYour previous reply could not be used because ${checked.problem}. Reply again with only the JSON object, with every field present.`,
      );
      result = {
        text: again.text,
        inputTokens: result.inputTokens + again.inputTokens,
        outputTokens: result.outputTokens + again.outputTokens,
      };
      checked = check(result.text);
    }
    if (!checked.ok) {
      const problem = checked.problem;
      const hint = request.rejectionHints?.find((h) => problem.includes(h.includes))?.message;
      throw new UnusableReply(result, badOutputError(caller.audience, credential.model, hint));
    }
    return {
      data: checked.data,
      imagesIgnored,
      tokens: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    };
  }

  /** Failures are logged with the provider's own words; the client only ever gets the mapped message. */
  private warn(
    caller: Caller,
    feature: AiUsageFeature,
    credential: ResolvedCredential,
    error: AiRequestError,
    rejectedReply?: string,
  ): void {
    logger.warn(
      {
        reason: error.reason,
        feature,
        businessId: caller.businessId,
        userId: caller.userId,
        provider: credential.provider,
        model: credential.model,
        providerStatus: error.provider?.status,
        providerMessage: error.provider ? redactKey(error.provider.message, credential.apiKey) : undefined,
        // Development only: the start of a reply that could not be used (it may hold customer details).
        ...(env.isDevelopment && rejectedReply ? { rejectedReply: rejectedReply.slice(0, 300) } : {}),
      },
      "AI request failed",
    );
  }
}
