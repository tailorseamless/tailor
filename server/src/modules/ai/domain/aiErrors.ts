import { AiProviderError, type AiErrorKind } from "../../../infrastructure/ai/aiProvider";
import { AppError } from "../../../shared/errors/AppError";

/**
 * Why an AI request failed, in a form the client can act on. The message is written for the person who
 * clicked: a business member can't change the platform's key or model, so they are told it is being dealt
 * with; the platform admin (testing a key) gets the technical reason and what to change.
 */
export const AI_FAILURE_REASONS = [
  "not_set_up",
  "out_of_tokens",
  "key_rejected",
  "provider_account",
  "model_rejected",
  "busy",
  "unreachable",
  "refused",
  "bad_output",
  "unreadable_file",
] as const;
export type AiFailureReason = (typeof AI_FAILURE_REASONS)[number];

/** Failures that last until the platform admin changes the key or the model. */
export const NEEDS_ADMIN_ACTION: ReadonlySet<AiFailureReason> = new Set([
  "not_set_up",
  "key_rejected",
  "provider_account",
  "model_rejected",
]);

export class AiRequestError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    public readonly reason: AiFailureReason,
    /** The provider's own words: for logs only. */
    public readonly provider?: { status?: number; message: string },
  ) {
    super(message, statusCode, [{ field: "ai", message: reason }]);
    this.name = "AiRequestError";
  }
}

export type AiAudience = "member" | "admin";

/** What a business member is told when the platform's AI setup is the problem. */
const MEMBER_SETUP_PROBLEM =
  "AI isn't working right now. Tailor Seamless has been told. Please try again later, or contact support if it keeps happening.";

export function notSetUpError(audience: AiAudience): AiRequestError {
  return new AiRequestError(
    audience === "admin"
      ? "No AI key is in use. Save a key and mark it In use first."
      : "AI isn't switched on yet. Please check back soon.",
    503,
    "not_set_up",
  );
}

export function outOfTokensError(): AiRequestError {
  return new AiRequestError(
    "Your business has no AI tokens left. Contact Tailor Seamless support to get more.",
    402,
    "out_of_tokens",
  );
}

interface Row {
  status: number;
  reason: AiFailureReason;
  admin: (provider: string, model: string) => string;
  member: string;
}

const BY_KIND: Record<AiErrorKind, Row> = {
  auth: {
    status: 502,
    reason: "key_rejected",
    admin: (p) => `${p} rejected the platform's API key. It may have been revoked or run out of credit.`,
    member: MEMBER_SETUP_PROBLEM,
  },
  account: {
    status: 502,
    reason: "provider_account",
    admin: (p, m) =>
      `${p} refused this because of the account behind the platform's API key: the model "${m}" may need a subscription or a higher plan, or the quota or balance has run out. Check the account with ${p}, or choose another model.`,
    member: MEMBER_SETUP_PROBLEM,
  },
  rate_limit: {
    status: 503,
    reason: "busy",
    admin: (p) => `${p} is limiting requests on the platform's key right now. Try again in a minute.`,
    member: "The AI service is busy right now. Try again in a minute.",
  },
  invalid_request: {
    status: 502,
    reason: "model_rejected",
    admin: (p, m) => `${p} could not run this with the model "${m}". Choose another model for this feature.`,
    member: MEMBER_SETUP_PROBLEM,
  },
  refused: {
    status: 422,
    reason: "refused",
    admin: () => "The AI declined to respond to this content.",
    member: "The AI declined to read this. Check the photo shows only your records, and try again.",
  },
  truncated: {
    status: 502,
    reason: "bad_output",
    admin: () => "The AI's answer was cut off before it finished. Try again.",
    member: "The AI's answer was cut off before it finished. Try again, with fewer photos at a time.",
  },
  unavailable: {
    status: 502,
    reason: "unreachable",
    admin: (p) => `${p} did not respond. Try again in a moment.`,
    member: "The AI service did not respond. Try again in a moment.",
  },
};

/** Any failure from a provider call, as an error a person can act on. Others pass through untouched. */
export function toRequestError(err: unknown, audience: AiAudience, providerLabel: string, model: string): unknown {
  if (!(err instanceof AiProviderError)) return err;
  const row = BY_KIND[err.kind];
  return new AiRequestError(
    audience === "admin" ? row.admin(providerLabel, model) : row.member,
    row.status,
    row.reason,
    { status: err.status, message: err.detail.slice(0, 600) },
  );
}

/** When the reply was unusable twice. A feature can pass a more helpful line. */
export function badOutputError(audience: AiAudience, model: string, hint?: string): AiRequestError {
  const message =
    hint ??
    (audience === "admin"
      ? `The AI returned an answer in an unexpected format. Try again, or choose another model: "${model}" may not be able to write this kind of draft.`
      : "The AI's answer couldn't be used. Try again, ideally with a clearer, well-lit photo.");
  return new AiRequestError(message, 502, "bad_output");
}
