import OpenAI from "openai";
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

export function normaliseOpenAi(err: unknown): AiProviderError {
  const known = passThrough(err);
  if (known) return known;
  if (err instanceof OpenAI.APIError) {
    const message = messageOf(err);
    return new AiProviderError(kindFor(err.status, message), message, err.status);
  }
  return new AiProviderError("unavailable", messageOf(err));
}

function client(apiKey: string, timeoutMs?: number): OpenAI {
  return new OpenAI({ apiKey, timeout: timeoutMs ?? env.ai.requestTimeoutMs, maxRetries: 1 });
}

/** Text first, then the pictures as data URLs. */
export function openAiUserContent(request: AiGenerateRequest): OpenAI.Chat.ChatCompletionContentPart[] {
  return [
    { type: "text", text: request.prompt },
    ...(request.documents ?? []).map((document): OpenAI.Chat.ChatCompletionContentPart => ({
      type: "file",
      file: { filename: document.filename, file_data: `data:${document.mimeType};base64,${document.data}` },
    })),
    ...(request.images ?? []).map((image): OpenAI.Chat.ChatCompletionContentPart => ({
      type: "image_url",
      image_url: { url: `data:${image.mimeType};base64,${image.data}` },
    })),
  ];
}

const CHAT_MODEL = /^(gpt-|o\d|chatgpt-)/;
const NOT_CHAT = /(audio|realtime|tts|transcribe|image|embedding|instruct|search|moderation)/;

export const openaiProvider: AiProvider = {
  id: "openai",

  async generate(apiKey, request): Promise<AiGenerateResult> {
    try {
      const completion = await client(apiKey, request.timeoutMs).chat.completions.create({
        model: request.model,
        max_completion_tokens: request.maxOutputTokens,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: openAiUserContent(request) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: request.schemaName, schema: request.jsonSchema, strict: true },
        },
      });
      const choice = completion.choices[0];
      if (!choice) throw new AiProviderError("unavailable", "no choices in the response");
      if (choice.finish_reason === "content_filter" || choice.message.refusal) {
        throw new AiProviderError("refused", choice.message.refusal ?? "content_filter");
      }
      if (choice.finish_reason === "length") throw new AiProviderError("truncated", "finish_reason length");
      return {
        text: choice.message.content ?? "",
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      throw normaliseOpenAi(err);
    }
  },

  async listModels(apiKey): Promise<AiModelInfo[]> {
    try {
      const models: { id: string; created: number }[] = [];
      for await (const model of client(apiKey, 30_000).models.list()) {
        if (CHAT_MODEL.test(model.id) && !NOT_CHAT.test(model.id))
          models.push({ id: model.id, created: model.created });
      }
      return models.sort((a, b) => b.created - a.created).map((model) => ({ id: model.id, label: model.id }));
    } catch (err) {
      throw normaliseOpenAi(err);
    }
  },
};
