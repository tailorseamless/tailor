import { ApiError, GoogleGenAI, type GenerateContentResponse, type Part } from "@google/genai";
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

/** Gemini answers a bad key with 400 and "API key" in the message, so that is "auth" too. */
export function normaliseGemini(err: unknown): AiProviderError {
  const known = passThrough(err);
  if (known) return known;
  if (err instanceof ApiError) {
    const message = messageOf(err);
    if (err.status === 400 && /api[ _-]?key/i.test(message)) return new AiProviderError("auth", message, err.status);
    return new AiProviderError(kindFor(err.status, message), message, err.status);
  }
  return new AiProviderError("unavailable", messageOf(err));
}

function client(apiKey: string, timeoutMs?: number): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: timeoutMs ?? env.ai.requestTimeoutMs, retryOptions: { attempts: 2 } },
  });
}

export function geminiUserParts(request: AiGenerateRequest): Part[] {
  return [
    ...(request.images ?? []).map((image): Part => ({ inlineData: { mimeType: image.mimeType, data: image.data } })),
    { text: request.prompt },
  ];
}

const BLOCKED = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"]);

function checkFinished(response: GenerateContentResponse): void {
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) throw new AiProviderError("refused", `blockReason ${String(blockReason)}`);
  const finish = String(response.candidates?.[0]?.finishReason ?? "");
  if (BLOCKED.has(finish)) throw new AiProviderError("refused", `finishReason ${finish}`);
  if (finish === "MAX_TOKENS") throw new AiProviderError("truncated", "finishReason MAX_TOKENS");
}

const NOT_CHAT = /(tts|image|audio|embedding|live|native-audio|robotics|computer-use)/;

export const geminiProvider: AiProvider = {
  id: "gemini",

  async generate(apiKey, request): Promise<AiGenerateResult> {
    try {
      const response = await client(apiKey, request.timeoutMs).models.generateContent({
        model: request.model,
        contents: [{ role: "user", parts: geminiUserParts(request) }],
        config: {
          systemInstruction: request.system,
          responseMimeType: "application/json",
          responseJsonSchema: request.jsonSchema,
          maxOutputTokens: request.maxOutputTokens,
        },
      });
      checkFinished(response);
      const usage = response.usageMetadata;
      return {
        text: response.text ?? "",
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      };
    } catch (err) {
      throw normaliseGemini(err);
    }
  },

  async listModels(apiKey): Promise<AiModelInfo[]> {
    try {
      const models: AiModelInfo[] = [];
      const pager = await client(apiKey, 30_000).models.list({ config: { pageSize: 100 } });
      for await (const model of pager) {
        const id = (model.name ?? "").replace(/^models\//, "");
        if (!id.startsWith("gemini") || NOT_CHAT.test(id)) continue;
        if (model.supportedActions && !model.supportedActions.includes("generateContent")) continue;
        models.push({ id, label: model.displayName || id });
      }
      return models;
    } catch (err) {
      throw normaliseGemini(err);
    }
  },
};
