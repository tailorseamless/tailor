/**
 * The one interface every AI vendor sits behind. Feature code never imports a vendor SDK: it calls
 * AiService, which picks the provider through the registry in providers.ts.
 */
export const AI_PROVIDERS = ["anthropic", "openai", "gemini", "ollama"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  gemini: "Google Gemini",
  ollama: "Ollama",
};

export interface AiImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  /** base64, no data: prefix */
  data: string;
}

export interface AiGenerateRequest {
  model: string;
  /** Default: env.ai.requestTimeoutMs */
  timeoutMs?: number;
  /** Ollama only: the server to call. */
  baseUrl?: string;
  system: string;
  prompt: string;
  /** A model that cannot see must fail with kind "invalid_request". */
  images?: AiImage[];
  schemaName: string;
  /** Every property required, additionalProperties: false. */
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
}

export interface AiGenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export type AiModelTier = "capable" | "balanced" | "fast";

export interface AiModelInfo {
  id: string;
  label: string;
  tier?: AiModelTier | null;
}

export interface AiProvider {
  readonly id: AiProviderId;
  generate(apiKey: string, request: AiGenerateRequest): Promise<AiGenerateResult>;
  /** Also the key check: a key the provider does not accept MUST fail with kind "auth". */
  listModels(apiKey: string, baseUrl?: string): Promise<AiModelInfo[]>;
}

export type AiErrorKind =
  "auth" | "account" | "rate_limit" | "invalid_request" | "refused" | "truncated" | "unavailable";

/**
 * 402, or wording that means plan / quota / balance. Checked FIRST, because providers report it
 * as 400, 402, 403 or 429 inconsistently.
 */
export function isAccountProblem(status: number | undefined, message: string): boolean {
  return (
    status === 402 ||
    /subscri|upgrade your|quota|billing|credit balance|insufficient (balance|credit|fund)|payment required|paid plan|free tier/i.test(
      message,
    )
  );
}

/** A vendor failure, normalised. `detail` is the provider's own text: for logs only, never for a client. */
export class AiProviderError extends Error {
  constructor(
    public readonly kind: AiErrorKind,
    public readonly detail: string,
    public readonly status?: number,
  ) {
    super(`AI provider error (${kind}): ${detail}`);
    this.name = "AiProviderError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The shared status → kind mapping (each adapter extracts status and message from its own error type first). */
export function kindFor(status: number | undefined, message: string): AiErrorKind {
  if (isAccountProblem(status, message)) return "account";
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status !== undefined && status >= 400 && status < 500) return "invalid_request";
  return "unavailable";
}

/** Anything that is already normalised passes through; anything else becomes "unavailable". */
export function passThrough(err: unknown): AiProviderError | null {
  return err instanceof AiProviderError ? err : null;
}

/**
 * A provider's error text with the key taken out. Some providers quote (part of) a rejected key in their
 * message; this text goes to logs, and a key must never appear there.
 */
export function redactKey(text: string, apiKey: string): string {
  if (apiKey.length < 8) return text;
  // Masked forms like "sk-proj-****wxyz" still give away the ends of the key.
  return text
    .split(apiKey)
    .join("[key]")
    .replace(/\b(sk|AIza)[-_A-Za-z0-9]*\*{2,}[-_A-Za-z0-9]*/g, "[key]");
}

export function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "Unknown error";
}
