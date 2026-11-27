/**
 * Every AI feature, by name: the name is its key in the usage log and in the per-feature model choice.
 * The client mirrors this list (client/src/types/ai.types.ts). Keep the two in step.
 */
export const AI_FEATURES = ["record_capture"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const AI_FEATURE_INFO: Record<AiFeature, { label: string; description: string }> = {
  record_capture: {
    label: "Snap a record",
    description:
      "Reads photos and files of records (measurement books, order cards, customer lists, spreadsheets) into drafts to check.",
  },
};

/** What the usage log may say: the features, plus the admin's key test (no business, no allowance). */
export const AI_USAGE_FEATURES = [...AI_FEATURES, "admin_test"] as const;
export type AiUsageFeature = (typeof AI_USAGE_FEATURES)[number];

/**
 * Tokens are the AI provider's own count (what it reads plus what it writes). Each business has one balance,
 * which the platform admin tops up. These bound it.
 */
export const DEFAULT_STARTING_TOKENS = 100_000;
/** The most that can be given or taken in one go, and the most a business can start with. */
export const MAX_TOKEN_AMOUNT = 100_000_000;
export const MAX_TOKEN_BALANCE = 2_000_000_000;
/** Set aside while a request runs (so parallel requests can't spend the same tokens), then settled to what was used. */
export const HOLD_TOKENS = 25_000;
