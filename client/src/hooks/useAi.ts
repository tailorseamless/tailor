import { aiAdminEndpoints, aiEndpoints } from "../endpoints/ai.endpoints";
import type { AiCredentialInput, AiFeature, AiProviderId } from "../types/ai.types";
import { useApiMutation, useApiQuery, usePaginatedQuery } from "./useApi";

/** Everything AI under one key, so any AI change refreshes status and balances. */
const ai = ["ai"] as const;

/** Is AI available to this person, and how many tokens their business has left. */
export function useAiStatus(feature?: AiFeature, enabled = true) {
  return useApiQuery([...ai, "status", feature ?? null], () => aiEndpoints.status(feature), {
    staleTime: 60_000,
    enabled,
  });
}

/** Snap a record: photos or files → drafts. Saves nothing; refreshes the tokens left. The page shows the error. */
export function useRecordCapture() {
  return useApiMutation((files: File[]) => aiEndpoints.recordCapture(files), {
    invalidate: [[...ai, "status"]],
    toastError: false,
  });
}

/* Platform admin */

export function useAiAdmin(enabled = true) {
  return useApiQuery([...ai, "admin"], () => aiAdminEndpoints.overview(), { enabled });
}

export function useAiBalances(params: { search?: string; page?: number }) {
  return usePaginatedQuery([...ai, "balances", params], () => aiAdminEndpoints.balances(params));
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
  const updateSettings = useApiMutation((startingTokens: number) => aiAdminEndpoints.updateSettings(startingTokens), {
    invalidate: [ai],
    success: "Starting tokens saved",
  });
  const grant = useApiMutation(
    (vars: { businessId: string; amount: number; note?: string }) =>
      aiAdminEndpoints.grantTokens(vars.businessId, vars.amount, vars.note),
    {
      invalidate: [ai],
      success: (_r, vars) => (vars.amount > 0 ? "Tokens added" : "Tokens taken back"),
      toastError: false,
    },
  );
  const test = useApiMutation((feature?: AiFeature) => aiAdminEndpoints.test(feature), {
    invalidate: [[...ai, "usage"]],
    toastError: false,
  });
  return { checkKey, save, activate, remove, setFeatureModel, updateSettings, grant, test };
}
