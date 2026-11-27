import type { AiModelTier, AiProviderId } from "../../../infrastructure/ai/aiProvider";
import type { AiFeature, AiUsageFeature } from "../domain/aiFeatures";
import type { CaptureMeasurementDraft, CaptureRecordDraft } from "../domain/recordCapture";

/** A saved platform key, as the admin sees it. Never the key or its ciphertext: only the last 4 characters. */
export interface AiCredentialDTO {
  id: string;
  provider: AiProviderId;
  providerLabel: string;
  model: string;
  modelTier: AiModelTier | null;
  featureModels: Partial<Record<AiFeature, string>>;
  baseUrl: string | null;
  keyLast4: string;
  isActive: boolean;
  /** False when AI_KEYS_SECRET has changed since it was saved: it must be saved again. */
  readable: boolean;
  updatedAt: Date;
}

export interface AiModelDTO {
  id: string;
  label: string;
  tier: AiModelTier | null;
}

/** The key the platform will use for a feature, decrypted. Server-side only, never serialised. */
export interface ResolvedCredential {
  apiKey: string;
  provider: AiProviderId;
  model: string;
  baseUrl: string | null;
}

/**
 * What any team member's screen needs to offer (or not offer) an AI feature. Which company or model runs it is
 * the platform's business, so it is not told here.
 */
export interface AiStatusDTO {
  /** The platform has AI switched on. */
  configured: boolean;
  /** On, and this business has tokens. */
  available: boolean;
  /** Why it isn't, in words for the person: null when available. */
  unavailableReason: string | null;
  tokensLeft: number;
}

export interface AiSettingsDTO {
  /** The tokens a business has until it first spends or is given some. */
  startingTokens: number;
  /** AI_KEYS_SECRET is set, so keys can be saved. */
  storageReady: boolean;
  updatedAt: Date | null;
}

/** One business's balance, for the admin. */
export interface AiTokenBalanceDTO {
  businessId: string;
  name: string;
  tokens: number;
  /** False until it has spent or been given tokens: it still has the starting amount. */
  started: boolean;
  usedLast30Days: number;
}

/** The admin's AI page in one call. */
export interface AiAdminOverviewDTO {
  settings: AiSettingsDTO;
  credentials: AiCredentialDTO[];
  features: { id: AiFeature; label: string; description: string }[];
}

export interface AiUsageSummaryDTO {
  days: number;
  totals: { requests: number; failed: number; inputTokens: number; outputTokens: number };
  byFeature: { feature: AiUsageFeature; requests: number; failed: number }[];
  byModel: {
    provider: AiProviderId;
    model: string;
    requests: number;
    failed: number;
    inputTokens: number;
    outputTokens: number;
  }[];
  /** Failures by kind: the first place to look when AI misbehaves. */
  byError: { errorKind: string; requests: number }[];
  topBusinesses: { businessId: string; name: string; requests: number }[];
  /** Businesses with no tokens left. */
  businessesOutOfTokens: number;
}

/** An existing customer a captured record is probably about. */
export interface CaptureMatchDTO {
  id: string;
  fullName: string;
  phone: string;
  /** "phone": the same number (strong). "name": exactly the same name (a suggestion). */
  by: "phone" | "name";
}

export interface CaptureRecordDTO extends Omit<CaptureRecordDraft, "measurement"> {
  measurement: (CaptureMeasurementDraft & { templateId: string | null; templateName: string | null }) | null;
  match: CaptureMatchDTO | null;
}

/** What Snap a record read. A draft only: nothing has been saved. */
export interface RecordCaptureDraftDTO {
  summary: string;
  records: CaptureRecordDTO[];
  /** What the AI couldn't read: the person checks these against the paper. */
  unreadable: string[];
  /** What to double-check. */
  caveats: string[];
  tokensUsed: number;
  tokensLeft: number;
}

export interface AiTestResultDTO {
  provider: AiProviderId;
  providerLabel: string;
  model: string;
  reply: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}
