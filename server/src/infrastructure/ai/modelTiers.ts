import type { AiModelTier, AiProviderId } from "./aiProvider";

/**
 * Providers don't publish a tier, so it is read from the model's NAME to help the settings screen advise.
 * Cosmetic only: nothing may depend on it except the advice text. Unknown names get null.
 */
export function modelTier(provider: AiProviderId, modelId: string): AiModelTier | null {
  const id = modelId.toLowerCase();
  switch (provider) {
    case "anthropic":
      if (id.includes("haiku")) return "fast";
      if (id.includes("sonnet")) return "balanced";
      if (/opus|fable|mythos/.test(id)) return "capable";
      return null;
    case "openai":
      if (/nano|mini/.test(id)) return "fast";
      if (/^(gpt-|o\d)/.test(id)) return "capable";
      return null;
    case "gemini":
      if (/flash-lite|flash-8b/.test(id)) return "fast";
      if (id.includes("flash")) return "balanced";
      if (/pro|ultra/.test(id)) return "capable";
      return null;
    case "ollama":
      return null;
  }
}
