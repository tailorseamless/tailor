import { Ollama } from "ollama";
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
import { OLLAMA_CLOUD } from "./serverAddress";

/** The SDK's ResponseError isn't exported as a type: recognise it by shape. */
export function normaliseOllama(err: unknown): AiProviderError {
  const known = passThrough(err);
  if (known) return known;
  const message = messageOf(err);
  const status = (err as { status_code?: unknown } | null)?.status_code;
  if (typeof status === "number") return new AiProviderError(kindFor(status, message), message, status);
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return new AiProviderError("unavailable", `timed out: ${message}`);
  }
  return new AiProviderError("unavailable", message);
}

/** The SDK has no timeout of its own, so every fetch gets one (joined with any signal the SDK passes). */
function client(apiKey: string, baseUrl: string | undefined, timeoutMs: number): Ollama {
  const timedFetch: typeof fetch = (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  };
  return new Ollama({
    host: baseUrl || OLLAMA_CLOUD,
    fetch: timedFetch,
    ...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
  });
}

/**
 * Ollama defaults to a ~4096-token context and silently drops the START of a longer prompt, which is where
 * the instructions are. Estimate the need (chars/3, plus room for the reply and each picture) and ask for more.
 */
export function contextFor(system: string, prompt: string, images: number, replyTokens = 2048): number | undefined {
  const estimate = Math.ceil((system.length + prompt.length) / 3) + replyTokens + images * 1500;
  if (estimate <= 4096) return undefined;
  return Math.min(32_768, Math.ceil(estimate / 1024) * 1024);
}

/** Not every open model honours `format`, so the schema is also spelled out in words. */
export function ollamaSystem(request: AiGenerateRequest): string {
  return `${request.system}\n\nReply with one JSON object and nothing else: no explanation and no code fence. Include every field. It must match this JSON Schema:\n${JSON.stringify(request.jsonSchema)}`;
}

export const ollamaProvider: AiProvider = {
  id: "ollama",

  async generate(apiKey, request): Promise<AiGenerateResult> {
    try {
      const system = ollamaSystem(request);
      const images = request.images ?? [];
      const numCtx = contextFor(system, request.prompt, images.length, Math.min(request.maxOutputTokens, 8192));
      const response = await client(apiKey, request.baseUrl, request.timeoutMs ?? env.ai.requestTimeoutMs).chat({
        model: request.model,
        stream: false,
        format: request.jsonSchema,
        messages: [
          { role: "system", content: system },
          { role: "user", content: request.prompt, ...(images.length ? { images: images.map((i) => i.data) } : {}) },
        ],
        options: { num_predict: request.maxOutputTokens, ...(numCtx ? { num_ctx: numCtx } : {}) },
      });
      if (response.done_reason === "length") throw new AiProviderError("truncated", "done_reason length");
      return {
        text: response.message.content,
        inputTokens: response.prompt_eval_count ?? 0,
        outputTokens: response.eval_count ?? 0,
      };
    } catch (err) {
      throw normaliseOllama(err);
    }
  },

  async listModels(apiKey, baseUrl): Promise<AiModelInfo[]> {
    try {
      const { models } = await client(apiKey, baseUrl, 30_000).list();
      return models.map((model) => ({ id: model.name, label: model.name }));
    } catch (err) {
      throw normaliseOllama(err);
    }
  },
};
