import { cleanParams, http, wrapCall } from "../transport/http";
import type {
  AiAdminOverview,
  AiCredential,
  AiCredentialInput,
  AiFeature,
  AiModel,
  AiProviderId,
  AiSettings,
  AiStatus,
  AiTestResult,
  AiUsageSummary,
  RecordCaptureDraft,
} from "../types/ai.types";

/** Checking a key calls the provider (server allows 30 s). */
const KEY_CHECK_TIMEOUT = 45_000;
/** The connection test (server allows 60 s). */
const TEST_TIMEOUT = 75_000;

/** Reading a page of handwriting (server allows 180 s). */
const CAPTURE_TIMEOUT = 200_000;

export const aiEndpoints = {
  status: (feature?: AiFeature) =>
    wrapCall<AiStatus>(() => http.get("/ai/status", { params: cleanParams({ feature }) })),
  /** Photos of paper records → drafts. Saves nothing. */
  recordCapture: (photos: File[]) => {
    const form = new FormData();
    for (const photo of photos) form.append("photos", photo);
    return wrapCall<RecordCaptureDraft>(() => http.post("/ai/record-capture", form, { timeout: CAPTURE_TIMEOUT }));
  },
};

export const aiAdminEndpoints = {
  overview: () => wrapCall<AiAdminOverview>(() => http.get("/admin/ai")),
  usage: (days: number) => wrapCall<AiUsageSummary>(() => http.get("/admin/ai/usage", { params: { days } })),
  updateSettings: (dailyLimit: number) => wrapCall<AiSettings>(() => http.patch("/admin/ai/settings", { dailyLimit })),
  models: (provider: AiProviderId, input: { apiKey?: string; baseUrl?: string }) =>
    wrapCall<AiModel[]>(() =>
      http.post(`/admin/ai/credentials/${provider}/models`, input, { timeout: KEY_CHECK_TIMEOUT }),
    ),
  save: (provider: AiProviderId, input: AiCredentialInput) =>
    wrapCall<AiCredential>(() => http.put(`/admin/ai/credentials/${provider}`, input, { timeout: KEY_CHECK_TIMEOUT })),
  activate: (provider: AiProviderId) =>
    wrapCall<AiCredential>(() => http.post(`/admin/ai/credentials/${provider}/activate`)),
  remove: (provider: AiProviderId) => wrapCall<null>(() => http.delete(`/admin/ai/credentials/${provider}`)),
  setFeatureModel: (feature: AiFeature, choice: { provider: AiProviderId; model: string } | null) =>
    wrapCall<AiCredential[]>(() =>
      choice
        ? http.put(`/admin/ai/feature-models/${feature}`, choice)
        : http.delete(`/admin/ai/feature-models/${feature}`),
    ),
  test: (feature?: AiFeature) =>
    wrapCall<AiTestResult>(() => http.post("/admin/ai/test", { feature }, { timeout: TEST_TIMEOUT })),
};
