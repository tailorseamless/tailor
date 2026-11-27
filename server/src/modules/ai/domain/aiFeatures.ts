/**
 * Every AI feature, by name: the name is its key in the usage log and in the per-feature model choice.
 * The client mirrors this list (client/src/types/ai.types.ts). Keep the two in step.
 */
export const AI_FEATURES = ["record_capture"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const AI_FEATURE_INFO: Record<AiFeature, { label: string; description: string }> = {
  record_capture: {
    label: "Snap a record",
    description: "Reads photos of paper records (measurement books, order cards, customer lists) into drafts to check.",
  },
};

/** What the usage log may say: the features, plus the admin's key test (no business, no allowance). */
export const AI_USAGE_FEATURES = [...AI_FEATURES, "admin_test"] as const;
export type AiUsageFeature = (typeof AI_USAGE_FEATURES)[number];

/** A new business starts with this many AI requests a day on the platform key; the admin changes it. */
export const DEFAULT_DAILY_LIMIT = 20;
export const MAX_DAILY_LIMIT = 10_000;
