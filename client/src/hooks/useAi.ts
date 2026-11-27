import { aiAdminEndpoints, aiEndpoints } from "../endpoints/ai.endpoints";
import type { AiCredentialInput, AiFeature, AiProviderId } from "../types/ai.types";
import { useApiMutation, useApiQuery } from "./useApi";

/** Everything AI under one key, so any AI change refreshes status and allowance. */
const ai = ["ai"] as const;

/** Is AI available to this person, and how many requests are left today. */
export function useAiStatus(feature?: AiFeature, enabled = true) {
  return useApiQuery([...ai, "status", feature ?? null], () => aiEndpoints.status(feature), {
    staleTime: 60_000,
    enabled,
  });
}

/** Snap a record: photos → drafts. Saves nothing; refreshes what is left today. The page shows the error. */
export function useRecordCapture() {
  return useApiMutation((photos: File[]) => aiEndpoints.recordCapture(photos), {
    invalidate: [[...ai, "status"]],
    toastError: false,
  });
}

/* Platform admin */

export function useAiAdmin(enabled = true) {
  return useApiQuery([...ai, "admin"], () => aiAdminEndpoints.overview(), { enabled });
}

export function useAiUsage(days: number) {
  return useApiQuery([...ai, "usage", days], () => aiAdminEndpoints.usage(days));
}

/**
 * A saved key's models. Its own cache key (not under ["ai"]) with a long stale time: every fetch calls the
 * provider, so it must not refetch on every AI change.
 */
export function useAiKeyModels(provider: AiProviderId | null) {
  return useApiQuery(["ai-models", provider], () => aiAdminEndpoints.models(provider as AiProviderId, {}), {
    enabled: provider !== null,
    staleTime: 10 * 60_000,
    retry: false,
  });
}

export function useAiAdminActions() {
  // Errors from checking or saving a key show beside the field, not as a toast.
  const checkKey = useApiMutation(
    (vars: { provider: AiProviderId; apiKey?: string; baseUrl?: string }) =>
      aiAdminEndpoints.models(vars.provider, { apiKey: vars.apiKey, baseUrl: vars.baseUrl }),
    { toastError: false },
  );
  const save = useApiMutation(
    (vars: { provider: AiProviderId; input: AiCredentialInput }) => aiAdminEndpoints.save(vars.provider, vars.input),
    {
      invalidate: (_r, vars) => [ai, ["ai-models", vars.provider]],
      success: "Key checked and saved",
      toastError: false,
    },
  );
  const activate = useApiMutation((provider: AiProviderId) => aiAdminEndpoints.activate(provider), {
    invalidate: [ai],
    success: "Key in use",
  });
  const remove = useApiMutation((provider: AiProviderId) => aiAdminEndpoints.remove(provider), {
    invalidate: (_r, provider) => [ai, ["ai-models", provider]],
    success: "Key removed",
  });
  const setFeatureModel = useApiMutation(
    (vars: { feature: AiFeature; choice: { provider: AiProviderId; model: string } | null }) =>
      aiAdminEndpoints.setFeatureModel(vars.feature, vars.choice),
    { invalidate: [ai], success: "Model saved" },
  );
  const updateSettings = useApiMutation((dailyLimit: number) => aiAdminEndpoints.updateSettings(dailyLimit), {
    invalidate: [ai],
    success: "Daily allowance saved",
  });
  const test = useApiMutation((feature?: AiFeature) => aiAdminEndpoints.test(feature), {
    invalidate: [[...ai, "usage"]],
    toastError: false,
  });
  return { checkKey, save, activate, remove, setFeatureModel, updateSettings, test };
}
