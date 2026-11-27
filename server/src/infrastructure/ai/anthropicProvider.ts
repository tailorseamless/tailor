import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import {
  AiProviderError,
  kindFor,
  messageOf,
  passThrough,
  type AiGenerateRequest,
  type AiGenerateResult,
  type AiModelInfo,
  type AiProvider,
} from "./aiProvider";

/** Every vendor error becomes an AiProviderError (Anthropic answers a bad key with 401). */
export function normaliseAnthropic(err: unknown): AiProviderError {
  const known = passThrough(err);
  if (known) return known;
  if (err instanceof Anthropic.APIError) {
    const message = messageOf(err);
    return new AiProviderError(kindFor(err.status, message), message, err.status);
  }
  return new AiProviderError("unavailable", messageOf(err));
}

/** A new client per call: the key belongs to this request, nothing is shared. */
function client(apiKey: string, timeoutMs?: number): Anthropic {
  return new Anthropic({ apiKey, timeout: timeoutMs ?? env.ai.requestTimeoutMs, maxRetries: 1 });
}

/** Document and image blocks go BEFORE the text. */
export function anthropicUserContent(request: AiGenerateRequest): Anthropic.ContentBlockParam[] {
  const documents: Anthropic.ContentBlockParam[] = (request.documents ?? []).map((document) => ({
    type: "document",
    source: { type: "base64", media_type: document.mimeType, data: document.data },
  }));
  const images: Anthropic.ContentBlockParam[] = (request.images ?? []).map((image) => ({
    type: "image",
    source: { type: "base64", media_type: image.mimeType, data: image.data },
  }));
  return [...documents, ...images, { type: "text", text: request.prompt }];
}

export const anthropicProvider: AiProvider = {
  id: "anthropic",

  async generate(apiKey, request): Promise<AiGenerateResult> {
    try {
      // No `thinking` or `effort`: the model is chosen in settings and older models reject them.
      const message = await client(apiKey, request.timeoutMs).messages.create({
        model: request.model,
        max_tokens: request.maxOutputTokens,
        system: request.system,
        messages: [{ role: "user", content: anthropicUserContent(request) }],
        output_config: { format: { type: "json_schema", schema: request.jsonSchema } },
      });
      if (message.stop_reason === "refusal") throw new AiProviderError("refused", "stop_reason refusal");
      if (message.stop_reason === "max_tokens") throw new AiProviderError("truncated", "stop_reason max_tokens");
      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
      const usage = message.usage;
      return {
        text,
        inputTokens:
          usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
        outputTokens: usage.output_tokens,
      };
    } catch (err) {
      throw normaliseAnthropic(err);
    }
  },

  async listModels(apiKey): Promise<AiModelInfo[]> {
    try {
      const models: AiModelInfo[] = [];
      for await (const model of client(apiKey, 30_000).models.list({ limit: 100 })) {
        models.push({ id: model.id, label: model.display_name || model.id });
      }
      return models;
    } catch (err) {
      throw normaliseAnthropic(err);
    }
  },
};
