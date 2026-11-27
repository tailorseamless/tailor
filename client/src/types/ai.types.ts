/** Mirrors server/src/modules/ai/dto/ai.dto.ts and the lists beside it. Keep them in step. */

export const AI_PROVIDERS = [
  { id: "anthropic", label: "Anthropic (Claude)", pricing: "https://www.anthropic.com/pricing#api" },
  { id: "openai", label: "OpenAI", pricing: "https://openai.com/api/pricing/" },
  { id: "gemini", label: "Google Gemini", pricing: "https://ai.google.dev/gemini-api/docs/pricing" },
  { id: "ollama", label: "Ollama", pricing: "https://ollama.com/pricing" },
] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number]["id"];

export const providerLabel = (id: AiProviderId): string => AI_PROVIDERS.find((p) => p.id === id)?.label ?? id;

/** server: AI_FEATURES */
export const AI_FEATURES = ["record_capture"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export type AiModelTier = "capable" | "balanced" | "fast";

export const TIER_LABEL: Record<AiModelTier, string> = {
  capable: "Most capable",
  balanced: "Balanced",
  fast: "Fast and cheap",
};

export interface AiModel {
  id: string;
  label: string;
  tier: AiModelTier | null;
}

export interface AiCredential {
  id: string;
  provider: AiProviderId;
  providerLabel: string;
  model: string;
  modelTier: AiModelTier | null;
  featureModels: Partial<Record<AiFeature, string>>;
  baseUrl: string | null;
  keyLast4: string;
  isActive: boolean;
  /** False when the server's AI_KEYS_SECRET changed after it was saved. */
  readable: boolean;
  updatedAt: string;
}

export interface AiSettings {
  startingTokens: number;
  storageReady: boolean;
  updatedAt: string | null;
}

export interface AiAdminOverview {
  settings: AiSettings;
  credentials: AiCredential[];
  features: { id: AiFeature; label: string; description: string }[];
}

export interface AiCredentialInput {
  /** Leave out to keep the saved key. */
  apiKey?: string;
  model: string;
  baseUrl?: string;
  makeActive?: boolean;
}

export interface AiStatus {
  /** The platform has AI switched on. */
  configured: boolean;
  /** On, and this business has tokens. */
  available: boolean;
  unavailableReason: string | null;
  tokensLeft: number;
}

/** One business's token balance, for the admin. */
export interface AiTokenBalance {
  businessId: string;
  name: string;
  tokens: number;
  /** False until it has spent or been given tokens: it still has the starting amount. */
  started: boolean;
  usedLast30Days: number;
}

export interface AiUsageSummary {
  days: number;
  totals: { requests: number; failed: number; inputTokens: number; outputTokens: number };
  byFeature: { feature: string; requests: number; failed: number }[];
  byModel: {
    provider: AiProviderId;
    model: string;
    requests: number;
    failed: number;
    inputTokens: number;
    outputTokens: number;
  }[];
  byError: { errorKind: string; requests: number }[];
  topBusinesses: { businessId: string; name: string; requests: number }[];
  businessesOutOfTokens: number;
}

export interface AiTestResult {
  provider: AiProviderId;
  providerLabel: string;
  model: string;
  reply: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}

/** What each failure kind in the usage log means, in words. */
export const ERROR_KIND_LABEL: Record<string, string> = {
  auth: "Key rejected",
  account: "Account, plan or balance",
  rate_limit: "Provider busy (rate limit)",
  invalid_request: "Model could not run it",
  refused: "AI declined",
  truncated: "Answer cut off",
  unavailable: "Provider did not respond",
  invalid_output: "Answer in the wrong format",
  unreadable_file: "PDF could not be read",
};

export const FEATURE_LABEL: Record<string, string> = {
  record_capture: "Snap a record",
  admin_test: "Admin connection test",
};

/* Snap a record (server: RecordCaptureDraftDTO). A draft only: nothing has been saved. */

export type CaptureGender = "female" | "male" | "other";

export interface CaptureMatch {
  id: string;
  fullName: string;
  phone: string;
  /** "phone": the same number. "name": exactly the same name (a suggestion only). */
  by: "phone" | "name";
}

export interface CaptureMeasurement {
  templateId: string | null;
  templateName: string | null;
  /** No template fits: what to call a new one. */
  suggestedTemplate: string | null;
  unit: "in" | "cm";
  /** The record didn't say which unit: it is the business's usual one. */
  unitAssumed: boolean;
  measuredOn: string | null;
  values: { name: string; value: number; asWritten: string; inTemplate: boolean }[];
  notes: string | null;
}

export interface CaptureOrder {
  items: {
    garmentName: string;
    quantity: number;
    unitPrice: number;
    priceKnown: boolean;
    description: string | null;
  }[];
  dueDate: string | null;
  amountPaid: number | null;
  /** Marked collected, delivered or done on the paper. */
  finished: boolean;
  notes: string | null;
}

export interface CaptureRecord {
  customer: {
    fullName: string;
    phone: string;
    phoneAsWritten: string | null;
    gender: CaptureGender | null;
    notes: string | null;
  };
  measurement: CaptureMeasurement | null;
  orders: CaptureOrder[];
  match: CaptureMatch | null;
}

export interface RecordCaptureDraft {
  summary: string;
  records: CaptureRecord[];
  unreadable: string[];
  caveats: string[];
  tokensUsed: number;
  tokensLeft: number;
}
