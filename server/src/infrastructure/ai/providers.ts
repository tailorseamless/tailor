import type { AiProvider, AiProviderId } from "./aiProvider";
import { anthropicProvider } from "./anthropicProvider";
import { geminiProvider } from "./geminiProvider";
import { ollamaProvider } from "./ollamaProvider";
import { openaiProvider } from "./openaiProvider";

/** Adding a vendor: one adapter file and one line here. */
const providers: Record<AiProviderId, AiProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  ollama: ollamaProvider,
};

/** Services take this in their constructor, so a fake provider can stand in. */
export type AiProviderResolver = (id: AiProviderId) => AiProvider;

export const providerFor: AiProviderResolver = (id) => providers[id];
